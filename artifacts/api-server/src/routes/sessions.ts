import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import {
  db,
  biometricReadingsTable,
  conversationsTable,
  intakeSessionsTable,
  patientsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { verifySessionAccess } from "../lib/sessionAccess";
import type { BiometricReading, ScreenerScoreType } from "@workspace/db";
import {
  AddBiometricsBody,
  AddBiometricsParams,
  CreateSessionBody,
  EndSessionParams,
  EndSessionResponse,
  GetBiometricsParams,
  GetBiometricsResponse,
  GetSessionBriefParams,
  GetSessionBriefResponse,
  ListSessionsResponse,
} from "@workspace/api-zod";
import OpenAI from "openai";
import { correlateWithTranscript } from "../lib/biometricCorrelation";
import { startSimulation, stopSimulation } from "../lib/biometricSimulator";
import {
  assignTherapistForProfile,
  inferClinicalProfile,
} from "../lib/therapistMatching";
import { runAgenticPipeline } from "../lib/agenticPipeline";
import { ensureTherapistsProvisioned } from "../lib/ensureTherapists";
import { getTherapistAccountByName } from "../lib/therapistRoster";
import { getConversationTranscript } from "./conversation";
import { fetchTavusTranscript } from "./tavus";

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey, ...(openaiBaseURL ? { baseURL: openaiBaseURL } : {}) })
  : null;

const router: IRouter = Router();

type CachedAssignment = {
  session: {
    id: number;
    label: string | null;
    startedAt: Date;
    endedAt: Date | null;
  };
  brief: {
    sessionId: number;
    generatedAt: Date;
    subjective: string;
    objective: {
      averageHr: number | null;
      averageHrv: number | null;
      peakHr: number | null;
      readingCount: number;
      biometricSubtextEvents: Array<{
        transcriptSegmentId: string;
        timestamp: Date;
        hrValue: number;
        baselineHr: number;
        spikePercent: number;
        text: string;
      }>;
    };
    assessment: string;
    plan: string;
    clinicalProfile?: string;
  };
  assignedTherapistId: number | null;
  phq9?: ScreenerScoreType | null;
  gad7?: ScreenerScoreType | null;
};

const sessionBriefCache = new Map<number, CachedAssignment>();

type GeneratedClinicalArtifacts = {
  brief: CachedAssignment["brief"];
  phq9: ScreenerScoreType | null;
  gad7: ScreenerScoreType | null;
};

const PHQ9_PROMPTS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling/staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving/speaking noticeably slowly, or being fidgety/restless",
  "Thoughts that you would be better off dead, or of hurting yourself",
];
const GAD7_PROMPTS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

function phq9Severity(score: number): string {
  if (score >= 20) return "Severe";
  if (score >= 15) return "Moderately severe";
  if (score >= 10) return "Moderate";
  if (score >= 5) return "Mild";
  return "Minimal";
}
function gad7Severity(score: number): string {
  if (score >= 15) return "Severe";
  if (score >= 10) return "Moderate";
  if (score >= 5) return "Mild";
  return "Minimal";
}

function normalizeScreener(
  raw: unknown,
  prompts: string[],
  severityFn: (n: number) => string,
): ScreenerScoreType | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  const items = prompts.map((prompt, i) => {
    const it = (itemsRaw[i] as Record<string, unknown> | undefined) ?? {};
    const rawScore = Number(it.score);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(3, Math.round(rawScore))) : 0;
    const evidence = typeof it.evidence === "string" ? it.evidence : undefined;
    return { prompt, score, evidence };
  });
  const total = items.reduce((s, it) => s + it.score, 0);
  const rationale = typeof obj.rationale === "string" ? obj.rationale : "";
  return {
    score: total,
    maxScore: prompts.length * 3,
    severity: severityFn(total),
    rationale,
    items,
    approvedAt: null,
    approvedBy: null,
  };
}

async function generateClinicalBrief(
  sessionId: number,
  transcript: string,
  biometrics: BiometricReading[]
): Promise<GeneratedClinicalArtifacts> {
  const segments = transcript
    .split(/\n+/)
    .filter(Boolean)
    .map((text, i) => ({
      id: `seg-${i}`,
      timestamp: new Date(Date.now() - (transcript.split("\n").length - i) * 6000),
      text,
    }));

  const { subtextEvents } = correlateWithTranscript(
    biometrics.map((r) => ({
      metric: r.metric as "HR" | "HRV",
      value: r.value,
      recordedAt: new Date(r.recordedAt),
    })),
    segments
  );

  const hrReadings = biometrics.filter((r) => r.metric === "HR");
  const hrvReadings = biometrics.filter((r) => r.metric === "HRV");

  const averageHr = hrReadings.length
    ? hrReadings.reduce((s, r) => s + r.value, 0) / hrReadings.length
    : null;
  const averageHrv = hrvReadings.length
    ? hrvReadings.reduce((s, r) => s + r.value, 0) / hrvReadings.length
    : null;
  const peakHr = hrReadings.length
    ? Math.max(...hrReadings.map((r) => r.value))
    : null;

  const profileInference = await inferClinicalProfile(transcript);

  const trimmedTranscript = transcript.trim();
  const hasTranscript = trimmedTranscript.length > 20;

  let subjective = hasTranscript
    ? "Intake conversation completed; transcript captured but automated summary unavailable. Manual chart review recommended."
    : "No conversational transcript was captured for this intake. The session may have ended before the patient engaged with the AI companion, or transcript ingestion from the video provider failed. Recommend repeating the intake or conducting a manual interview before clinical decisions.";
  let assessment = hasTranscript
    ? "Clinical impression pending — automated assessment could not be generated. Defer to clinician review of the raw transcript and biometric trace."
    : "Insufficient data to form a clinical impression. No transcript available for analysis.";
  let plan = hasTranscript
    ? "Route to assigned therapist for full review of session transcript and biometric data prior to first appointment."
    : "Re-attempt intake session, or schedule a live clinician-led interview. Verify Tavus conversation capture and OpenAI summarization pipeline are operating.";

  let phq9: ScreenerScoreType | null = null;
  let gad7: ScreenerScoreType | null = null;

  if (openai && hasTranscript) {
    const biometricSummary = averageHr
      ? `Average HR ${averageHr.toFixed(0)} bpm (peak ${peakHr?.toFixed(0)} bpm), average HRV ${averageHrv?.toFixed(0) ?? "N/A"} ms, ${subtextEvents.length} sympathetic activation moment(s) correlated to transcript content.`
      : "No biometric data was captured during this session.";

    const profileHint = profileInference
      ? `An automated profile classifier suggested: ${profileInference.label} (${profileInference.confidence} confidence). Treat this as a hint only — your own reading of the transcript should drive the note.`
      : "No prior profile classification is available.";

    const transcriptSlice = trimmedTranscript.slice(0, 16000);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a senior licensed clinical psychologist documenting an initial intake interview for a mental-health practice. The interview was conducted by an AI conversational companion using a structured trauma-informed intake protocol. Your job is to read the verbatim transcript, optionally consider biometric context, and produce a thorough, professional SOAP note that a treating clinician can use as the foundation of a chart.

Write in the voice of an experienced clinician: precise, neutral, observational, free of filler. Use clinical terminology where appropriate (presenting problem, onset, duration, frequency, severity, functional impairment, risk factors, protective factors, mental status observations, working diagnosis with differential, treatment plan). Do not invent facts the transcript does not support — if information is absent, explicitly note it as "not assessed" or "not reported." Never hedge with phrases like "the patient seems to" when the transcript states it directly. Never include disclaimers about being an AI.

Output a JSON object with exactly these keys:

- "subjective": A detailed narrative paragraph (4–8 sentences, 120–250 words) summarizing what the patient reported in their own words. Cover: chief complaint / reason for seeking care; symptom history (onset, duration, frequency, severity, triggers); functional impact (work, relationships, sleep, appetite); relevant psychosocial context the patient volunteered (family, support system, prior treatment, medications, substance use); and any stated goals for treatment. Quote brief patient phrases when especially clinically meaningful.

- "assessment": A 3–5 sentence clinical impression (90–180 words). State the working formulation, the most likely DSM-5-TR or ICD-11 diagnostic considerations with a brief differential, severity, risk indicators (suicidal/homicidal ideation, self-harm, substance use) explicitly noted as present/denied/not assessed, and any protective factors. If the biometric context shows elevated arousal during specific topics, integrate that observation.

- "plan": A 3–6 sentence concrete next-step plan (80–180 words). Include: recommended modality and frequency of therapy, any indicated assessments or referrals (psychiatric eval, PCP, labs, screeners like PHQ-9 / GAD-7 / PCL-5), safety planning if relevant, between-session interventions or psychoeducation, and the cadence for reviewing progress.

- "phq9": A PHQ-9 estimate inferred from the transcript. Object with:
  - "items": exactly 9 entries in standard PHQ-9 order (interest/pleasure, depressed mood, sleep, energy, appetite, self-worth, concentration, psychomotor, suicidal ideation). Each entry: { "score": 0|1|2|3 (0=not at all, 1=several days, 2=more than half the days, 3=nearly every day), "evidence": short quoted phrase or paraphrase from the transcript, or "" if not directly addressed }
  - "rationale": 1–2 sentence clinician-style note explaining the overall pattern. Be conservative when the item wasn't actually discussed — score 0 and note "not directly assessed."
- "gad7": A GAD-7 estimate inferred from the transcript. Object with:
  - "items": exactly 7 entries in standard GAD-7 order (nervous/anxious, can't stop worrying, worrying too much, trouble relaxing, restless, easily irritable, afraid something awful). Each entry same shape as PHQ-9 items.
  - "rationale": 1–2 sentence note. Same conservative scoring rule.

These are clinician-decision-support estimates. Only score items the transcript actually supports; score 0 (with empty/short evidence) for items not addressed.

CONTEXT FOR THIS SESSION
${biometricSummary}
${profileHint}

Return ONLY a single valid JSON object. No prose, no markdown fences, no explanation.`,
          },
          {
            role: "user",
            content: `Verbatim intake transcript follows. Speaker labels may be present.\n\n----- BEGIN TRANSCRIPT -----\n${transcriptSlice}\n----- END TRANSCRIPT -----`,
          },
        ],
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (content) {
        const parsed = JSON.parse(content);
        if (typeof parsed.subjective === "string" && parsed.subjective.trim().length > 0) {
          subjective = parsed.subjective.trim();
        }
        if (typeof parsed.assessment === "string" && parsed.assessment.trim().length > 0) {
          assessment = parsed.assessment.trim();
        }
        if (typeof parsed.plan === "string" && parsed.plan.trim().length > 0) {
          plan = parsed.plan.trim();
        }
        phq9 = normalizeScreener(parsed.phq9, PHQ9_PROMPTS, phq9Severity);
        gad7 = normalizeScreener(parsed.gad7, GAD7_PROMPTS, gad7Severity);
      } else {
        console.warn(`[brief] OpenAI returned empty content for session ${sessionId}`);
      }
    } catch (err) {
      console.error(`[brief] Failed to generate SOAP note for session ${sessionId}:`, err);
    }
  } else if (!openai) {
    console.warn(`[brief] OpenAI not configured — skipping SOAP generation for session ${sessionId}`);
  } else if (!hasTranscript) {
    console.warn(`[brief] Empty transcript for session ${sessionId} — skipping OpenAI call`);
  }

  return {
    brief: {
      sessionId,
      generatedAt: new Date(),
      subjective,
      objective: {
        averageHr: averageHr ? Math.round(averageHr * 10) / 10 : null,
        averageHrv: averageHrv ? Math.round(averageHrv * 10) / 10 : null,
        peakHr: peakHr ?? null,
        readingCount: biometrics.length,
        biometricSubtextEvents: subtextEvents,
      },
      assessment,
      plan,
      clinicalProfile: profileInference?.slug ?? undefined,
    },
    phq9,
    gad7,
  };
}

router.get("/sessions", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));

  if (!patient) {
    res.json([]);
    return;
  }

  const sessions = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.patientId, patient.id))
    .orderBy(desc(intakeSessionsTable.startedAt));
  res.json(ListSessionsResponse.parse(sessions));
});

router.get("/patient/my-sessions", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));

  if (!patient) {
    res.json([]);
    return;
  }

  const sessions = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.patientId, patient.id))
    .orderBy(desc(intakeSessionsTable.startedAt));

  res.json(ListSessionsResponse.parse(sessions));
});

router.post("/sessions", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;
  const body = CreateSessionBody.parse(req.body ?? {});

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));

  if (!patient) {
    res.status(403).json({ error: "Patient account not found. Please complete onboarding before starting a session." });
    return;
  }

  const [session] = await db
    .insert(intakeSessionsTable)
    .values({ label: body.label ?? null, patientId: patient.id })
    .returning();
  startSimulation(session.id);
  res.status(201).json(session);
});

async function buildAndPersistBrief(
  sessionId: number,
  options: { endTavus: boolean; pollDelaysMs: number[] }
): Promise<{ brief: CachedAssignment["brief"]; updated: typeof intakeSessionsTable.$inferSelect; assignedTherapistId: number | null; transcriptOk: boolean }> {
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  let transcript = "";
  if (conversation?.externalId) {
    // Tavus only finalizes the transcript AFTER the conversation is ended.
    if (options.endTavus && process.env.TAVUS_API_KEY) {
      try {
        await fetch(`https://tavusapi.com/v2/conversations/${conversation.externalId}/end`, {
          method: "POST",
          headers: { "x-api-key": process.env.TAVUS_API_KEY },
        });
      } catch (err) {
        console.warn(`[brief] Failed to end Tavus conversation ${conversation.externalId}:`, err);
      }
    }
    for (const delay of options.pollDelaysMs) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      transcript = await fetchTavusTranscript(conversation.externalId);
      if (transcript && transcript.trim().length > 20) break;
    }
  }
  if (!transcript || transcript.trim().length <= 20) {
    transcript = await getConversationTranscript(sessionId);
  }
  const transcriptOk = transcript.trim().length > 20;

  const biometrics = await db
    .select()
    .from(biometricReadingsTable)
    .where(eq(biometricReadingsTable.sessionId, sessionId))
    .orderBy(asc(biometricReadingsTable.recordedAt));

  const { brief, phq9, gad7 } = await generateClinicalBrief(sessionId, transcript, biometrics);

  const therapists = await ensureTherapistsProvisioned();

  // Run the agentic recommendation pipeline. On any failure, fall back to the
  // legacy single-call assignment but still mark the trace as degraded so the
  // UI can show the user.
  let pipelineTrace: Awaited<ReturnType<typeof runAgenticPipeline>>["trace"] | null = null;
  let assignedTherapistId: number | null = null;
  try {
    const pipeline = await runAgenticPipeline({
      sessionId,
      transcript,
      biometrics,
      phq9,
      gad7,
      therapists,
      topN: 3,
    });
    pipelineTrace = pipeline.trace;
    assignedTherapistId = pipeline.matches[0]?.therapistId ?? null;
    // Mirror the inferred slug into the legacy clinicalProfile field so older
    // UI paths keep working until they migrate to clinicalProfileV2.
    if (pipeline.primaryProfile) brief.clinicalProfile = pipeline.primaryProfile;
  } catch (err) {
    console.error(`[agent:orchestrator] Pipeline failed for session ${sessionId}, falling back:`, err);
    const profileSlug = brief.clinicalProfile ?? "anxiety";
    const [assignedTherapist] = assignTherapistForProfile(therapists, profileSlug, 1);
    assignedTherapistId = assignedTherapist?.therapist.id ?? null;
    // Persist a minimal degraded trace so the UI can clearly indicate that
    // the agentic pipeline failed and we fell back to legacy heuristics.
    pipelineTrace = {
      pipelineVersion: "v2.0.0",
      generatedAt: new Date().toISOString(),
      degraded: true,
      degradedReason: `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      plan: [],
      planRationale: "Pipeline orchestrator threw — using legacy single-call heuristic fallback.",
      steps: [
        {
          stage: "orchestrator",
          label: "Agentic pipeline",
          startedAt: new Date().toISOString(),
          durationMs: 0,
          status: "error",
          summary: "Pipeline orchestrator threw; legacy heuristic match was used instead.",
          detail: { error: err instanceof Error ? err.message : String(err) },
        },
      ],
      clinicalProfileV2: null,
      candidatePoolSize: therapists.length,
      shortlistSize: 0,
      scored: [],
      finalMatchIds: assignedTherapistId ? [assignedTherapistId] : [],
    };
  }

  // Preserve previous approval timestamps if they exist (re-generation should
  // not silently un-approve a clinician-approved screener).
  const [existing] = await db
    .select({ phq9: intakeSessionsTable.phq9, gad7: intakeSessionsTable.gad7 })
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, sessionId));

  const mergedPhq9 = phq9
    ? { ...phq9, approvedAt: existing?.phq9?.approvedAt ?? null, approvedBy: existing?.phq9?.approvedBy ?? null }
    : existing?.phq9 ?? null;
  const mergedGad7 = gad7
    ? { ...gad7, approvedAt: existing?.gad7?.approvedAt ?? null, approvedBy: existing?.gad7?.approvedBy ?? null }
    : existing?.gad7 ?? null;

  const [updated] = await db
    .update(intakeSessionsTable)
    .set({
      endedAt: options.endTavus ? new Date() : undefined,
      clinicalBrief: brief,
      assignedTherapistId,
      phq9: mergedPhq9,
      gad7: mergedGad7,
      agentTrace: pipelineTrace ?? undefined,
    })
    .where(eq(intakeSessionsTable.id, sessionId))
    .returning();

  sessionBriefCache.set(sessionId, {
    session: {
      id: updated.id,
      label: updated.label,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt ?? null,
    },
    brief,
    assignedTherapistId,
    phq9: mergedPhq9,
    gad7: mergedGad7,
  });

  return { brief, updated, assignedTherapistId, transcriptOk };
}

const FALLBACK_NO_TRANSCRIPT_MARKER = "No conversational transcript was captured";
const FALLBACK_TRANSCRIPT_PRESENT_MARKER = "automated summary unavailable";

function isFallbackBrief(brief: unknown): boolean {
  if (!brief || typeof brief !== "object") return true;
  const subjective = (brief as { subjective?: unknown }).subjective;
  if (typeof subjective !== "string") return true;
  return (
    subjective.includes(FALLBACK_NO_TRANSCRIPT_MARKER) ||
    subjective.includes(FALLBACK_TRANSCRIPT_PRESENT_MARKER)
  );
}

router.patch("/sessions/:sessionId/end", requireAuth, async (req, res): Promise<void> => {
  const { sessionId } = EndSessionParams.parse(req.params);
  const access = await verifySessionAccess(sessionId, req.clerkUserId!);

  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  if (access.role !== "patient") {
    res.status(403).json({ error: "Only the patient may end their session" });
    return;
  }

  stopSimulation(sessionId);

  // Short bounded attempt — Tavus often needs longer than this to finalize the
  // transcript, so the GET /brief endpoint will lazily retry below.
  const { updated } = await buildAndPersistBrief(sessionId, {
    endTavus: true,
    pollDelaysMs: [1500, 3000, 5000],
  });

  res.json(EndSessionResponse.parse(updated));
});

router.post("/sessions/:sessionId/biometrics", async (req, res): Promise<void> => {
  // This endpoint is intentionally open — no auth cookie required.
  // The session ID in the URL scopes writes to the correct session.
  // This allows the iOS/Apple Watch companion app to POST biometrics
  // without browser-based authentication. Authenticated patients may also POST.
  const { sessionId } = AddBiometricsParams.parse(req.params);
  const body = AddBiometricsBody.parse(req.body);

  const [session] = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await db.insert(biometricReadingsTable).values(
    body.readings.map((r) => ({
      sessionId,
      metric: r.metric,
      value: r.value,
      recordedAt: r.recordedAt,
    }))
  );

  res.status(201).json({ inserted: body.readings.length });
});

router.get("/sessions/:sessionId/biometrics", requireAuth, async (req, res): Promise<void> => {
  const { sessionId } = GetBiometricsParams.parse(req.params);

  const access = await verifySessionAccess(sessionId, req.clerkUserId!);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }

  const readings = await db
    .select()
    .from(biometricReadingsTable)
    .where(eq(biometricReadingsTable.sessionId, sessionId))
    .orderBy(asc(biometricReadingsTable.recordedAt));

  res.json(GetBiometricsResponse.parse(readings));
});

router.get("/sessions/:sessionId/brief", requireAuth, async (req, res): Promise<void> => {
  const { sessionId } = GetSessionBriefParams.parse(req.params);

  const access = await verifySessionAccess(sessionId, req.clerkUserId!);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }

  // If the persisted brief is a fallback (Tavus transcript wasn't ready when
  // the session ended), opportunistically retry once now. Each subsequent
  // refresh from the client will retry again until Tavus delivers.
  if (access.session.endedAt && isFallbackBrief(access.session.clinicalBrief)) {
    try {
      const { updated } = await buildAndPersistBrief(sessionId, {
        endTavus: false,
        pollDelaysMs: [0, 2000, 4000],
      });
      res.json(GetSessionBriefResponse.parse(updated));
      return;
    } catch (err) {
      console.error(`[brief] Lazy regeneration failed for session ${sessionId}:`, err);
    }
  }

  res.json(GetSessionBriefResponse.parse(access.session));
});

export function getSessionBriefFromCache(sessionId: number): CachedAssignment | undefined {
  return sessionBriefCache.get(sessionId);
}

export default router;
