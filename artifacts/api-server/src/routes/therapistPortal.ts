import { Router, type IRouter } from "express";
import { eq, asc, inArray } from "drizzle-orm";
import {
  db,
  therapistsTable,
  patientsTable,
  intakeSessionsTable,
  biometricReadingsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function getTherapistMe(req: import("express").Request, res: import("express").Response): Promise<void> {
  const clerkUserId = req.clerkUserId!;

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));

  if (!therapist) {
    res.status(403).json({ error: "Therapist account not found." });
    return;
  }

  res.json({
    id: therapist.id,
    name: therapist.name,
    providerType: therapist.providerType,
    providerProfile: therapist.providerProfile,
  });
}

router.get("/therapist/me", requireAuth, getTherapistMe);
router.get("/therapists/me", requireAuth, getTherapistMe);

router.get("/therapist/my-patients", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));

  if (!therapist) {
    res.status(403).json({ error: "Therapist account not found." });
    return;
  }

  const sessions = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.assignedTherapistId, therapist.id))
    .orderBy(asc(intakeSessionsTable.startedAt));

  const patientIds = [...new Set(sessions.map((s) => s.patientId).filter((id): id is number => id !== null))];

  const patients = patientIds.length > 0
    ? await db
        .select()
        .from(patientsTable)
        .where(inArray(patientsTable.id, patientIds))
    : [];

  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const enriched = await Promise.all(
    sessions.map(async (session) => {
      const biometrics = await db
        .select()
        .from(biometricReadingsTable)
        .where(eq(biometricReadingsTable.sessionId, session.id))
        .orderBy(asc(biometricReadingsTable.recordedAt));

      const patient = session.patientId ? patientMap.get(session.patientId) : null;

      return {
        session: {
          id: session.id,
          label: session.label,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          clinicalBrief: session.clinicalBrief,
        },
        patient: patient
          ? {
              id: patient.id,
              name: patient.name,
              demographics: patient.demographics,
              createdAt: patient.createdAt,
            }
          : null,
        biometrics: biometrics.map((b) => ({
          id: b.id,
          metric: b.metric,
          value: b.value,
          recordedAt: b.recordedAt,
        })),
      };
    })
  );

  res.json({
    therapist: {
      id: therapist.id,
      name: therapist.name,
      providerProfile: therapist.providerProfile,
    },
    patients: enriched,
  });
});

export default router;
