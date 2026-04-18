import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, intakeSessionsTable, biometricReadingsTable } from "@workspace/db";
import {
  CreateSessionBody,
  EndSessionParams,
  EndSessionResponse,
  ListSessionsResponse,
  AddBiometricsParams,
  AddBiometricsBody,
  GetBiometricsParams,
  GetBiometricsResponse,
  GetSessionBriefParams,
  GetSessionBriefResponse,
} from "@workspace/api-zod";
import { correlateWithTranscript } from "../lib/biometricCorrelation";
import { startSimulation, stopSimulation } from "../lib/biometricSimulator";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

router.get("/sessions", async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(intakeSessionsTable)
    .orderBy(desc(intakeSessionsTable.startedAt));

  res.json(ListSessionsResponse.parse(sessions));
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(intakeSessionsTable)
    .values({ label: parsed.data.label ?? null })
    .returning();

  req.log.info({ sessionId: session.id }, "Intake session created");
  startSimulation(session.id);
  res.status(201).json(session);
});

router.patch("/sessions/:sessionId/end", async (req, res): Promise<void> => {
  const params = EndSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .update(intakeSessionsTable)
    .set({ endedAt: new Date() })
    .where(eq(intakeSessionsTable.id, params.data.sessionId))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  stopSimulation(session.id);
  req.log.info({ sessionId: session.id }, "Intake session ended");
  res.json(EndSessionResponse.parse(session));
});

router.post("/sessions/:sessionId/biometrics", async (req, res): Promise<void> => {
  const params = AddBiometricsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AddBiometricsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existingSession] = await db
    .select({ id: intakeSessionsTable.id })
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, params.data.sessionId));

  if (!existingSession) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (body.data.readings.length === 0) {
    res.status(201).json({ inserted: 0 });
    return;
  }

  const rows = body.data.readings.map((r) => ({
    sessionId: params.data.sessionId,
    metric: r.metric,
    value: r.value,
    recordedAt: new Date(r.recordedAt),
  }));

  await db.insert(biometricReadingsTable).values(rows);

  req.log.info(
    { sessionId: params.data.sessionId, count: rows.length },
    "Biometric readings stored"
  );
  res.status(201).json({ inserted: rows.length });
});

router.get("/sessions/:sessionId/biometrics", async (req, res): Promise<void> => {
  const params = GetBiometricsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existingSession] = await db
    .select({ id: intakeSessionsTable.id })
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, params.data.sessionId));

  if (!existingSession) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const readings = await db
    .select()
    .from(biometricReadingsTable)
    .where(eq(biometricReadingsTable.sessionId, params.data.sessionId))
    .orderBy(asc(biometricReadingsTable.recordedAt));

  res.json(GetBiometricsResponse.parse(readings));
});

async function generateSoapNotes(
  sessionId: number,
  durationMinutes: number | null,
  averageHr: number | null,
  averageHrv: number | null,
  peakHr: number | null,
  readingCount: number
): Promise<{ subjective: string; assessment: string; plan: string }> {
  const biometricSummary =
    readingCount > 0
      ? `Heart Rate — avg: ${averageHr?.toFixed(1) ?? "N/A"} BPM, peak: ${peakHr?.toFixed(1) ?? "N/A"} BPM. HRV — avg: ${averageHrv?.toFixed(1) ?? "N/A"} ms. Total readings: ${readingCount}.`
      : "No biometric data was captured during this session.";

  const durationStr = durationMinutes != null ? `${durationMinutes} minutes` : "unknown duration";

  const prompt = `You are a clinical documentation assistant generating a SOAP note for an AI-assisted patient intake session.

Session details:
- Duration: ${durationStr}
- Biometrics: ${biometricSummary}

Generate a concise, clinically appropriate SOAP note. Return a JSON object with exactly these three keys:
- "subjective": Patient-reported symptoms and concerns as would be captured by an AI intake assistant. Keep it 2-3 sentences.
- "assessment": Clinical assessment based on the biometric patterns observed. Reference specific values where relevant. 2-3 sentences.
- "plan": Recommended next steps and follow-up actions. 2-3 bullet-point style sentences.

Respond with only valid JSON, no markdown.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from AI");

  const parsed = JSON.parse(block.text);
  return {
    subjective: parsed.subjective ?? "No subjective data available.",
    assessment: parsed.assessment ?? "No assessment available.",
    plan: parsed.plan ?? "No plan available.",
  };
}

router.get("/sessions/:sessionId/brief", async (req, res): Promise<void> => {
  const params = GetSessionBriefParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, params.data.sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const readings = await db
    .select()
    .from(biometricReadingsTable)
    .where(eq(biometricReadingsTable.sessionId, params.data.sessionId))
    .orderBy(asc(biometricReadingsTable.recordedAt));

  const hrReadings = readings.filter((r) => r.metric === "HR");
  const hrvReadings = readings.filter((r) => r.metric === "HRV");

  const averageHr =
    hrReadings.length > 0
      ? hrReadings.reduce((sum, r) => sum + r.value, 0) / hrReadings.length
      : null;

  const averageHrv =
    hrvReadings.length > 0
      ? hrvReadings.reduce((sum, r) => sum + r.value, 0) / hrvReadings.length
      : null;

  const peakHr =
    hrReadings.length > 0 ? Math.max(...hrReadings.map((r) => r.value)) : null;

  const biometricReadingsForCorrelation = readings.map((r) => ({
    metric: r.metric as "HR" | "HRV",
    value: r.value,
    recordedAt: r.recordedAt,
  }));

  const { subtextEvents } = correlateWithTranscript(biometricReadingsForCorrelation, []);

  let soapNotes = session.soapNotes as { subjective: string; assessment: string; plan: string } | null;

  if (!soapNotes && session.endedAt) {
    const durationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    try {
      soapNotes = await generateSoapNotes(
        session.id,
        durationMinutes,
        averageHr,
        averageHrv,
        peakHr,
        readings.length
      );
      await db
        .update(intakeSessionsTable)
        .set({ soapNotes })
        .where(eq(intakeSessionsTable.id, session.id));
    } catch (err) {
      req.log.error({ err, sessionId: session.id }, "Failed to generate SOAP notes");
    }
  }

  const brief = GetSessionBriefResponse.parse({
    sessionId: session.id,
    generatedAt: new Date(),
    subjective:
      soapNotes?.subjective ??
      (session.endedAt
        ? "Unable to generate clinical summary at this time."
        : "Session is still in progress — complete the session to generate the clinical brief."),
    objective: {
      averageHr,
      averageHrv,
      peakHr,
      readingCount: readings.length,
      biometricSubtextEvents: subtextEvents.map((e) => ({
        transcriptSegmentId: e.transcriptSegmentId,
        timestamp: e.timestamp,
        hrValue: e.hrValue,
        baselineHr: e.baselineHr,
        spikePercent: e.spikePercent,
        text: e.text,
      })),
    },
    assessment:
      soapNotes?.assessment ??
      (session.endedAt
        ? "Unable to generate assessment at this time."
        : "Assessment will be generated after the session ends."),
    plan:
      soapNotes?.plan ??
      (session.endedAt
        ? "Unable to generate treatment plan at this time."
        : "Treatment plan will be generated after the session ends."),
  });

  res.json(brief);
});

export default router;
