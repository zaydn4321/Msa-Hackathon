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
import type { BiometricReading } from "@workspace/db";
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
};

const sessionBriefCache = new Map<number, CachedAssignment>();

async function generateClinicalBrief(
  sessionId: number,
  transcript: string,
  biometrics: BiometricReading[]
): Promise<CachedAssignment["brief"]> {
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

  // Prefer Tavus transcript (real conversation) over local message store
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  let transcript = "";
  if (conversation?.externalId) {
    // Tavus only finalizes the transcript AFTER the conversation is ended.
    // First tell Tavus to end the conversation, then poll for the transcript.
    if (process.env.TAVUS_API_KEY) {
      try {
        await fetch(`https://tavusapi.com/v2/conversations/${conversation.externalId}/end`, {
          method: "POST",
          headers: { "x-api-key": process.env.TAVUS_API_KEY },
        });
      } catch (err) {
        console.warn(`[brief] Failed to end Tavus conversation ${conversation.externalId}:`, err);
      }
    }

    // Poll with bounded budget so we don't exceed proxy/client timeouts.
    const delaysMs = [1500, 3000, 5000, 8000];
    for (const delay of delaysMs) {
      await new Promise((r) => setTimeout(r, delay));
      transcript = await fetchTavusTranscript(conversation.externalId);
      if (transcript && transcript.trim().length > 20) break;
    }
    if (!transcript || transcript.trim().length <= 20) {
      console.warn(
        `[brief] Tavus transcript still insufficient after end+retries for session ${sessionId} (conversation ${conversation.externalId}) — will try local messages`
      );
    }
  }
  // Fall back to local messages if Tavus returned nothing usable
  if (!transcript || transcript.trim().length <= 20) {
    transcript = await getConversationTranscript(sessionId);
  }
  const biometrics = await db
    .select()
    .from(biometricReadingsTable)
    .where(eq(biometricReadingsTable.sessionId, sessionId))
    .orderBy(asc(biometricReadingsTable.recordedAt));

  const brief = await generateClinicalBrief(sessionId, transcript, biometrics);

  const therapists = await ensureTherapistsProvisioned();
  const profileSlug = brief.clinicalProfile ?? "anxiety";
  const [assignedTherapist] = assignTherapistForProfile(therapists, profileSlug, 1);

  const [updated] = await db
    .update(intakeSessionsTable)
    .set({
      endedAt: new Date(),
      clinicalBrief: brief,
      assignedTherapistId: assignedTherapist?.therapist.id ?? null,
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
    assignedTherapistId: assignedTherapist?.therapist.id ?? null,
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

  res.json(GetSessionBriefResponse.parse(access.session));
});

export function getSessionBriefFromCache(sessionId: number): CachedAssignment | undefined {
  return sessionBriefCache.get(sessionId);
}

export default router;
