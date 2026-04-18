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

  const brief = GetSessionBriefResponse.parse({
    sessionId: session.id,
    generatedAt: new Date(),
    subjective:
      "[Placeholder] Patient-reported symptoms and concerns will be populated by the AI assistant in Task 4.",
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
      "[Placeholder] Clinical assessment will be generated by the AI assistant in Task 4.",
    plan: "[Placeholder] Treatment plan recommendations will be generated by the AI assistant in Task 4.",
  });

  res.json(brief);
});

export default router;
