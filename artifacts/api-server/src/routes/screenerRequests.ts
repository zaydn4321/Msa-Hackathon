import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  patientsTable,
  therapistsTable,
  patientTherapistMatchesTable,
  intakeSessionsTable,
  screenerRequestsTable,
  screenerResponsesTable,
  type ScreenerRequest,
  type ScreenerResponse,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  type Instrument,
  REQUEST_TTL_MS,
  instrumentLabel,
  instrumentPrompts,
  RESPONSE_OPTIONS,
  scoreFromResponses,
  suggestCptCodes,
} from "../lib/screenerCatalog";

const router: IRouter = Router();

const VALID_INSTRUMENTS: Instrument[] = ["phq9", "gad7"];

async function getTherapistByClerk(clerkUserId: string) {
  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));
  return therapist ?? null;
}

async function getPatientByClerk(clerkUserId: string) {
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));
  return patient ?? null;
}

// Therapist must own the patient relationship: at least one accepted match.
async function ensureTherapistOwnsPatient(therapistId: number, patientId: number): Promise<boolean> {
  const [m] = await db
    .select({ id: patientTherapistMatchesTable.id })
    .from(patientTherapistMatchesTable)
    .where(
      and(
        eq(patientTherapistMatchesTable.therapistId, therapistId),
        eq(patientTherapistMatchesTable.patientId, patientId),
        eq(patientTherapistMatchesTable.status, "accepted"),
      ),
    )
    .limit(1);
  return !!m;
}

async function expireStaleRequests(): Promise<void> {
  const now = new Date();
  // Best-effort sweep — mark anything past expiresAt as expired.
  const stale = await db
    .select({ id: screenerRequestsTable.id, expiresAt: screenerRequestsTable.expiresAt, status: screenerRequestsTable.status })
    .from(screenerRequestsTable)
    .where(inArray(screenerRequestsTable.status, ["pending", "in_progress"]));
  const ids = stale.filter((r) => r.expiresAt < now).map((r) => r.id);
  if (ids.length > 0) {
    await db
      .update(screenerRequestsTable)
      .set({ status: "expired" })
      .where(inArray(screenerRequestsTable.id, ids));
  }
}

function publicRequestPayload(r: ScreenerRequest) {
  return {
    id: r.id,
    instrument: r.instrument,
    note: r.note,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
    draftResponses: r.draftResponses ?? {},
    label: instrumentLabel(r.instrument as Instrument),
    prompts: instrumentPrompts(r.instrument as Instrument),
    options: RESPONSE_OPTIONS,
  };
}

// === THERAPIST: create a re-assessment request ===
router.post("/therapist/screener-requests", requireAuth, async (req, res): Promise<void> => {
  const therapist = await getTherapistByClerk(req.clerkUserId!);
  if (!therapist) {
    res.status(403).json({ error: "Therapist account required" });
    return;
  }
  const body = (req.body ?? {}) as { patientId?: number; instruments?: string[]; note?: string };
  const patientId = Number(body.patientId);
  const instruments = (body.instruments ?? [])
    .map((s) => String(s).toLowerCase())
    .filter((s): s is Instrument => VALID_INSTRUMENTS.includes(s as Instrument));
  if (!Number.isFinite(patientId) || instruments.length === 0) {
    res.status(400).json({ error: "patientId and at least one instrument required" });
    return;
  }
  const owns = await ensureTherapistOwnsPatient(therapist.id, patientId);
  if (!owns) {
    res.status(403).json({ error: "You don't have an accepted match with this patient" });
    return;
  }

  await expireStaleRequests();

  // Rate limit: one open request per (patient, instrument).
  const existingOpen = await db
    .select()
    .from(screenerRequestsTable)
    .where(
      and(
        eq(screenerRequestsTable.patientId, patientId),
        inArray(screenerRequestsTable.instrument, instruments),
        inArray(screenerRequestsTable.status, ["pending", "in_progress"]),
      ),
    );
  const blocked = new Set(existingOpen.map((r) => r.instrument));
  const toCreate = instruments.filter((i) => !blocked.has(i));
  if (toCreate.length === 0) {
    res.status(409).json({
      error: "An open request already exists for the selected instrument(s)",
      existing: existingOpen.map((r) => ({ id: r.id, instrument: r.instrument, status: r.status })),
    });
    return;
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);
  const cpt = suggestCptCodes(toCreate);
  const inserted = await db
    .insert(screenerRequestsTable)
    .values(
      toCreate.map((instrument) => ({
        patientId,
        therapistId: therapist.id,
        instrument,
        note,
        status: "pending" as const,
        magicToken: randomBytes(24).toString("hex"),
        expiresAt,
        cptSuggestions: cpt,
      })),
    )
    .returning();

  res.status(201).json({
    requests: inserted.map((r) => ({
      id: r.id,
      instrument: r.instrument,
      status: r.status,
      magicToken: r.magicToken,
      expiresAt: r.expiresAt,
      cptSuggestions: r.cptSuggestions,
    })),
    blocked: Array.from(blocked),
  });
});

// === THERAPIST: list requests + responses for one of their patients ===
router.get("/therapist/patients/:patientId/screener-activity", requireAuth, async (req, res): Promise<void> => {
  const therapist = await getTherapistByClerk(req.clerkUserId!);
  if (!therapist) {
    res.status(403).json({ error: "Therapist account required" });
    return;
  }
  const patientId = Number(req.params.patientId);
  if (!Number.isFinite(patientId)) {
    res.status(400).json({ error: "Invalid patient id" });
    return;
  }
  const owns = await ensureTherapistOwnsPatient(therapist.id, patientId);
  if (!owns) {
    res.status(403).json({ error: "Not your patient" });
    return;
  }
  await expireStaleRequests();
  const requests = await db
    .select()
    .from(screenerRequestsTable)
    .where(
      and(
        eq(screenerRequestsTable.patientId, patientId),
        eq(screenerRequestsTable.therapistId, therapist.id),
      ),
    )
    .orderBy(desc(screenerRequestsTable.createdAt));
  const responses = await db
    .select()
    .from(screenerResponsesTable)
    .where(
      and(
        eq(screenerResponsesTable.patientId, patientId),
        eq(screenerResponsesTable.therapistId, therapist.id),
      ),
    )
    .orderBy(desc(screenerResponsesTable.submittedAt));

  // Attach the most recent baseline (from intake_sessions) per instrument.
  const [baselineSession] = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.patientId, patientId))
    .orderBy(desc(intakeSessionsTable.startedAt))
    .limit(1);

  res.json({
    requests: requests.map((r) => ({
      id: r.id,
      instrument: r.instrument,
      status: r.status,
      note: r.note,
      magicToken: r.magicToken,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      cptSuggestions: r.cptSuggestions,
    })),
    responses: responses.map(buildResponsePayload),
    baseline: {
      sessionId: baselineSession?.id ?? null,
      startedAt: baselineSession?.startedAt ?? null,
      phq9: baselineSession?.phq9 ?? null,
      gad7: baselineSession?.gad7 ?? null,
    },
  });
});

function buildResponsePayload(r: ScreenerResponse) {
  return {
    id: r.id,
    requestId: r.requestId,
    instrument: r.instrument,
    score: r.score,
    submittedAt: r.submittedAt,
    approvedAt: r.approvedAt,
    approvedBy: r.approvedBy,
    confirmedCpt: r.confirmedCpt,
  };
}

// === THERAPIST: approve a response, optionally confirming CPT codes ===
router.patch("/therapist/screener-responses/:responseId", requireAuth, async (req, res): Promise<void> => {
  const therapist = await getTherapistByClerk(req.clerkUserId!);
  if (!therapist) {
    res.status(403).json({ error: "Therapist account required" });
    return;
  }
  const responseId = Number(req.params.responseId);
  if (!Number.isFinite(responseId)) {
    res.status(400).json({ error: "Invalid response id" });
    return;
  }
  const body = (req.body ?? {}) as { approved?: boolean; confirmedCpt?: string[] };
  const [resp] = await db
    .select()
    .from(screenerResponsesTable)
    .where(eq(screenerResponsesTable.id, responseId));
  if (!resp || resp.therapistId !== therapist.id) {
    res.status(404).json({ error: "Response not found" });
    return;
  }
  const update: Partial<ScreenerResponse> = {};
  if (typeof body.approved === "boolean") {
    update.approvedAt = body.approved ? new Date() : null;
    update.approvedBy = body.approved ? therapist.id : null;
    // Mirror approval into the JSONB score blob too for consistency with intake screeners.
    update.score = {
      ...resp.score,
      approvedAt: body.approved ? new Date().toISOString() : null,
      approvedBy: body.approved ? therapist.id : null,
    };
  }
  if (Array.isArray(body.confirmedCpt)) {
    update.confirmedCpt = body.confirmedCpt
      .map((c) => String(c).trim())
      .filter((c) => /^\d{4,5}$/.test(c))
      .slice(0, 8);
  }
  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "No changes" });
    return;
  }
  const [updated] = await db
    .update(screenerResponsesTable)
    .set(update)
    .where(eq(screenerResponsesTable.id, responseId))
    .returning();
  res.json({ response: buildResponsePayload(updated) });
});

// === THERAPIST: cancel a pending request ===
router.delete("/therapist/screener-requests/:requestId", requireAuth, async (req, res): Promise<void> => {
  const therapist = await getTherapistByClerk(req.clerkUserId!);
  if (!therapist) {
    res.status(403).json({ error: "Therapist account required" });
    return;
  }
  const reqId = Number(req.params.requestId);
  if (!Number.isFinite(reqId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [r] = await db
    .select()
    .from(screenerRequestsTable)
    .where(eq(screenerRequestsTable.id, reqId));
  if (!r || r.therapistId !== therapist.id) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (r.status === "completed") {
    res.status(409).json({ error: "Cannot cancel a completed request" });
    return;
  }
  await db
    .update(screenerRequestsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(screenerRequestsTable.id, reqId));
  res.json({ ok: true });
});

// === PATIENT: list pending screener requests for in-app notification ===
router.get("/patient/screener-requests", requireAuth, async (req, res): Promise<void> => {
  const patient = await getPatientByClerk(req.clerkUserId!);
  if (!patient) {
    res.json({ requests: [] });
    return;
  }
  await expireStaleRequests();
  const requests = await db
    .select()
    .from(screenerRequestsTable)
    .where(
      and(
        eq(screenerRequestsTable.patientId, patient.id),
        inArray(screenerRequestsTable.status, ["pending", "in_progress"]),
      ),
    )
    .orderBy(desc(screenerRequestsTable.createdAt));

  // Look up therapist names for display.
  const therapistIds = [...new Set(requests.map((r) => r.therapistId))];
  const therapists = therapistIds.length
    ? await db.select().from(therapistsTable).where(inArray(therapistsTable.id, therapistIds))
    : [];
  const tMap = new Map(therapists.map((t) => [t.id, t]));

  res.json({
    requests: requests.map((r) => ({
      id: r.id,
      instrument: r.instrument,
      label: instrumentLabel(r.instrument as Instrument),
      status: r.status,
      note: r.note,
      magicToken: r.magicToken,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      therapistName: tMap.get(r.therapistId)?.name ?? "Your therapist",
    })),
  });
});

// === PUBLIC (magic link): fetch a screener for the patient to fill out ===
router.get("/screeners/by-token/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  if (!token || token.length < 8) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }
  const [r] = await db
    .select()
    .from(screenerRequestsTable)
    .where(eq(screenerRequestsTable.magicToken, token));
  if (!r) {
    res.status(404).json({ error: "Screener not found" });
    return;
  }
  if (r.status === "completed") {
    res.status(410).json({ error: "This screener has already been completed", status: "completed" });
    return;
  }
  if (r.status === "cancelled") {
    res.status(410).json({ error: "This screener was cancelled by your therapist", status: "cancelled" });
    return;
  }
  if (r.expiresAt < new Date()) {
    if (r.status !== "expired") {
      await db.update(screenerRequestsTable).set({ status: "expired" }).where(eq(screenerRequestsTable.id, r.id));
    }
    res.status(410).json({ error: "This screener link has expired", status: "expired" });
    return;
  }

  // Look up therapist name for display.
  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.id, r.therapistId));

  res.json({
    request: publicRequestPayload(r),
    therapistName: therapist?.name ?? "Your therapist",
  });
});

// === PUBLIC: auto-save partial answers ===
router.patch("/screeners/by-token/:token/draft", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const body = (req.body ?? {}) as { responses?: Record<string, unknown> };
  const [r] = await db
    .select()
    .from(screenerRequestsTable)
    .where(eq(screenerRequestsTable.magicToken, token));
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (r.status === "completed" || r.status === "cancelled" || r.expiresAt < new Date()) {
    res.status(410).json({ error: "Screener no longer accepting input" });
    return;
  }
  const prompts = instrumentPrompts(r.instrument as Instrument);
  const cleaned: Record<number, number> = {};
  for (const [k, v] of Object.entries(body.responses ?? {})) {
    const idx = Number(k);
    const val = Number(v);
    if (Number.isInteger(idx) && idx >= 0 && idx < prompts.length && Number.isFinite(val)) {
      cleaned[idx] = Math.max(0, Math.min(3, Math.round(val)));
    }
  }
  await db
    .update(screenerRequestsTable)
    .set({
      draftResponses: cleaned,
      status: r.status === "pending" ? "in_progress" : r.status,
    })
    .where(eq(screenerRequestsTable.id, r.id));
  res.json({ ok: true });
});

// === PUBLIC: submit completed screener ===
router.post("/screeners/by-token/:token/submit", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const body = (req.body ?? {}) as { responses?: Record<string, unknown> };
  const [r] = await db
    .select()
    .from(screenerRequestsTable)
    .where(eq(screenerRequestsTable.magicToken, token));
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (r.status === "completed") {
    res.status(409).json({ error: "Already submitted" });
    return;
  }
  if (r.status === "cancelled" || r.expiresAt < new Date()) {
    res.status(410).json({ error: "Screener no longer accepting input" });
    return;
  }
  const prompts = instrumentPrompts(r.instrument as Instrument);
  const responses: Record<number, number> = {};
  for (const [k, v] of Object.entries(body.responses ?? {})) {
    const idx = Number(k);
    const val = Number(v);
    if (Number.isInteger(idx) && idx >= 0 && idx < prompts.length) {
      responses[idx] = Number.isFinite(val) ? Math.max(0, Math.min(3, Math.round(val))) : 0;
    }
  }
  // Require all prompts answered.
  for (let i = 0; i < prompts.length; i++) {
    if (typeof responses[i] !== "number") {
      res.status(400).json({ error: `Missing answer for question ${i + 1}` });
      return;
    }
  }
  const score = scoreFromResponses(r.instrument as Instrument, responses);

  // Insert response (or update if one already exists for this request).
  const [existing] = await db
    .select()
    .from(screenerResponsesTable)
    .where(eq(screenerResponsesTable.requestId, r.id));
  let saved: ScreenerResponse;
  if (existing) {
    [saved] = await db
      .update(screenerResponsesTable)
      .set({ score, submittedAt: new Date() })
      .where(eq(screenerResponsesTable.id, existing.id))
      .returning();
  } else {
    [saved] = await db
      .insert(screenerResponsesTable)
      .values({
        requestId: r.id,
        patientId: r.patientId,
        therapistId: r.therapistId,
        instrument: r.instrument,
        score,
      })
      .returning();
  }
  await db
    .update(screenerRequestsTable)
    .set({
      status: "completed",
      completedAt: new Date(),
      draftResponses: responses,
    })
    .where(eq(screenerRequestsTable.id, r.id));

  res.status(201).json({ response: buildResponsePayload(saved) });
});

// === THERAPIST: insurance-ready export payload (one response) ===
router.get("/therapist/screener-responses/:responseId/export", requireAuth, async (req, res): Promise<void> => {
  const therapist = await getTherapistByClerk(req.clerkUserId!);
  if (!therapist) {
    res.status(403).json({ error: "Therapist account required" });
    return;
  }
  const id = Number(req.params.responseId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [resp] = await db
    .select()
    .from(screenerResponsesTable)
    .where(eq(screenerResponsesTable.id, id));
  if (!resp || resp.therapistId !== therapist.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [request] = await db
    .select()
    .from(screenerRequestsTable)
    .where(eq(screenerRequestsTable.id, resp.requestId));
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, resp.patientId));
  const [baselineSession] = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.patientId, resp.patientId))
    .orderBy(desc(intakeSessionsTable.startedAt))
    .limit(1);
  const baseline =
    resp.instrument === "phq9" ? baselineSession?.phq9 ?? null : baselineSession?.gad7 ?? null;

  res.json({
    response: buildResponsePayload(resp),
    request: request
      ? {
          id: request.id,
          note: request.note,
          createdAt: request.createdAt,
          completedAt: request.completedAt,
          cptSuggestions: request.cptSuggestions ?? [],
        }
      : null,
    patient: patient ? { id: patient.id, name: patient.name, demographics: patient.demographics } : null,
    therapist: { id: therapist.id, name: therapist.name },
    baseline,
    instrumentLabel: instrumentLabel(resp.instrument as Instrument),
  });
});

export default router;
