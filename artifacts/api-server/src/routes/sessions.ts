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

  let subjective = "Patient completed intake interview.";
  let assessment = "Clinical profile requires further assessment.";
  let plan = "Schedule follow-up appointment with matched therapist.";

  if (openai) {
    try {
      const biometricSummary =
        averageHr
          ? `Average HR: ${averageHr.toFixed(0)} bpm. Peak HR: ${peakHr?.toFixed(0)} bpm. Average HRV: ${averageHrv?.toFixed(0) ?? "N/A"} ms. Elevated HR moments: ${subtextEvents.length}.`
          : "No biometric data available.";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a clinical documentation specialist generating a SOAP note from an intake session.

Biometric summary: ${biometricSummary}
${profileInference ? `Inferred clinical profile: ${profileInference.label} (${profileInference.confidence} confidence)` : ""}

Generate a concise SOAP note with:
- Subjective: Patient's reported concerns in 2-3 sentences
- Assessment: Clinical impression in 1-2 sentences  
- Plan: Recommended next steps in 1-2 sentences

Return ONLY valid JSON: {"subjective": "...", "assessment": "...", "plan": "..."}`,
          },
          {
            role: "user",
            content: `Intake transcript:\n${transcript.slice(0, 4000)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (content) {
        const parsed = JSON.parse(content);
        subjective = parsed.subjective ?? subjective;
        assessment = parsed.assessment ?? assessment;
        plan = parsed.plan ?? plan;
      }
    } catch {
      // Fall through to defaults
    }
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
    transcript = await fetchTavusTranscript(conversation.externalId);
  }
  // Fall back to local messages if Tavus returned nothing
  if (!transcript) {
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
