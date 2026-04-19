import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  patientsTable,
  therapistsTable,
  intakeSessionsTable,
  patientTherapistMatchesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Patient creates a match request to a therapist for one of their intake sessions.
router.post("/sessions/:sessionId/match", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;
  const sessionId = Number(req.params.sessionId);
  if (!Number.isFinite(sessionId)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  const { therapistId, message } = (req.body ?? {}) as { therapistId?: number; message?: string };
  if (!therapistId || !Number.isFinite(Number(therapistId))) {
    res.status(400).json({ error: "therapistId is required" });
    return;
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));
  if (!patient) {
    res.status(403).json({ error: "Patient account not found" });
    return;
  }

  const [session] = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, sessionId));
  if (!session || session.patientId !== patient.id) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.id, Number(therapistId)));
  if (!therapist) {
    res.status(404).json({ error: "Therapist not found" });
    return;
  }

  // Idempotent insert. Unique index on (patient,session,therapist) means a
  // concurrent retry could lose the race; we catch and re-select instead of 500.
  const inserted = await db
    .insert(patientTherapistMatchesTable)
    .values({
      patientId: patient.id,
      sessionId,
      therapistId: Number(therapistId),
      message: typeof message === "string" ? message.trim().slice(0, 1000) : null,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [
        patientTherapistMatchesTable.patientId,
        patientTherapistMatchesTable.sessionId,
        patientTherapistMatchesTable.therapistId,
      ],
    })
    .returning();

  if (inserted[0]) {
    res.status(201).json({ match: inserted[0], alreadyExisted: false });
    return;
  }

  const [existing] = await db
    .select()
    .from(patientTherapistMatchesTable)
    .where(
      and(
        eq(patientTherapistMatchesTable.patientId, patient.id),
        eq(patientTherapistMatchesTable.sessionId, sessionId),
        eq(patientTherapistMatchesTable.therapistId, Number(therapistId)),
      ),
    );
  res.status(200).json({ match: existing, alreadyExisted: true });
});

// Patient lists their matches (so the brief page can show "already matched").
router.get("/patient/my-matches", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));
  if (!patient) {
    res.json({ matches: [] });
    return;
  }
  const matches = await db
    .select()
    .from(patientTherapistMatchesTable)
    .where(eq(patientTherapistMatchesTable.patientId, patient.id))
    .orderBy(desc(patientTherapistMatchesTable.createdAt));
  res.json({ matches });
});

// Therapist sees incoming patient matches with full intake brief + screeners.
router.get("/therapist/my-matches", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;
  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));
  if (!therapist) {
    res.status(403).json({ error: "Therapist account not found" });
    return;
  }

  const matches = await db
    .select()
    .from(patientTherapistMatchesTable)
    .where(eq(patientTherapistMatchesTable.therapistId, therapist.id))
    .orderBy(desc(patientTherapistMatchesTable.createdAt));

  const sessionIds = [...new Set(matches.map((m) => m.sessionId))];
  const patientIds = [...new Set(matches.map((m) => m.patientId))];

  const sessions = sessionIds.length
    ? await db.select().from(intakeSessionsTable).where(inArray(intakeSessionsTable.id, sessionIds))
    : [];
  const patients = patientIds.length
    ? await db.select().from(patientsTable).where(inArray(patientsTable.id, patientIds))
    : [];

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const enriched = matches.map((m) => {
    const session = sessionMap.get(m.sessionId);
    const patient = patientMap.get(m.patientId);
    return {
      match: m,
      patient: patient
        ? {
            id: patient.id,
            name: patient.name,
            demographics: patient.demographics,
            createdAt: patient.createdAt,
          }
        : null,
      session: session
        ? {
            id: session.id,
            label: session.label,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            clinicalBrief: session.clinicalBrief,
            phq9: session.phq9,
            gad7: session.gad7,
          }
        : null,
    };
  });

  res.json({ matches: enriched });
});

// Therapist updates a match: approve PHQ-9, GAD-7, or change status.
router.patch("/therapist/matches/:matchId", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;
  const matchId = Number(req.params.matchId);
  if (!Number.isFinite(matchId)) {
    res.status(400).json({ error: "Invalid match id" });
    return;
  }
  const body = (req.body ?? {}) as {
    phq9Approved?: boolean;
    gad7Approved?: boolean;
    status?: "pending" | "accepted" | "declined";
  };

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));
  if (!therapist) {
    res.status(403).json({ error: "Therapist account not found" });
    return;
  }

  const [match] = await db
    .select()
    .from(patientTherapistMatchesTable)
    .where(eq(patientTherapistMatchesTable.id, matchId));
  if (!match || match.therapistId !== therapist.id) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [session] = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, match.sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const now = new Date().toISOString();
  let nextPhq9 = session.phq9;
  let nextGad7 = session.gad7;
  if (typeof body.phq9Approved === "boolean" && session.phq9) {
    nextPhq9 = {
      ...session.phq9,
      approvedAt: body.phq9Approved ? now : null,
      approvedBy: body.phq9Approved ? therapist.id : null,
    };
  }
  if (typeof body.gad7Approved === "boolean" && session.gad7) {
    nextGad7 = {
      ...session.gad7,
      approvedAt: body.gad7Approved ? now : null,
      approvedBy: body.gad7Approved ? therapist.id : null,
    };
  }
  if (nextPhq9 !== session.phq9 || nextGad7 !== session.gad7) {
    await db
      .update(intakeSessionsTable)
      .set({ phq9: nextPhq9, gad7: nextGad7 })
      .where(eq(intakeSessionsTable.id, session.id));
  }

  let updatedMatch = match;
  if (body.status && ["pending", "accepted", "declined"].includes(body.status)) {
    [updatedMatch] = await db
      .update(patientTherapistMatchesTable)
      .set({
        status: body.status,
        respondedAt: body.status === "pending" ? null : new Date(),
      })
      .where(eq(patientTherapistMatchesTable.id, matchId))
      .returning();
  }

  res.json({
    match: updatedMatch,
    session: { id: session.id, phq9: nextPhq9, gad7: nextGad7 },
  });
});

export default router;
