import { Router, type IRouter } from "express";
import { eq, isNull, and, sql } from "drizzle-orm";
import { db, patientsTable, therapistsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEV_ROLE_SWITCH_ENABLED = process.env.NODE_ENV !== "production";

router.get("/dev/role-switch/enabled", (_req, res): void => {
  res.json({ enabled: DEV_ROLE_SWITCH_ENABLED });
});

router.post("/dev/role-switch", requireAuth, async (req, res): Promise<void> => {
  if (!DEV_ROLE_SWITCH_ENABLED) {
    res.status(403).json({ error: "Role switching is disabled in production." });
    return;
  }

  const clerkUserId = req.clerkUserId!;
  const { role, priorPatientId } = (req.body ?? {}) as {
    role?: "patient" | "therapist";
    priorPatientId?: number;
  };

  if (role !== "patient" && role !== "therapist") {
    res.status(400).json({ error: "role must be 'patient' or 'therapist'" });
    return;
  }

  if (role === "therapist") {
    const [currentPatient] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.clerkUserId, clerkUserId));

    let savedPatientId: number | null = null;
    if (currentPatient) {
      savedPatientId = currentPatient.id;
      await db
        .update(patientsTable)
        .set({ clerkUserId: null })
        .where(eq(patientsTable.id, currentPatient.id));
    }

    const [alreadyLinked] = await db
      .select()
      .from(therapistsTable)
      .where(eq(therapistsTable.clerkUserId, clerkUserId));

    let therapistRow = alreadyLinked;
    if (!therapistRow) {
      const [available] = await db
        .select()
        .from(therapistsTable)
        .where(isNull(therapistsTable.clerkUserId))
        .orderBy(therapistsTable.id)
        .limit(1);

      if (!available) {
        res.status(409).json({ error: "No unlinked therapist profile available." });
        return;
      }

      const [updated] = await db
        .update(therapistsTable)
        .set({ clerkUserId })
        .where(eq(therapistsTable.id, available.id))
        .returning();
      therapistRow = updated;
    }

    logger.info(
      { clerkUserId, therapistId: therapistRow.id, savedPatientId },
      "[dev] Switched user to therapist"
    );

    res.json({
      role: "therapist",
      therapist: { id: therapistRow.id, name: therapistRow.name },
      priorPatientId: savedPatientId,
    });
    return;
  }

  const [currentTherapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));

  if (currentTherapist) {
    await db
      .update(therapistsTable)
      .set({ clerkUserId: null })
      .where(eq(therapistsTable.id, currentTherapist.id));
  }

  if (priorPatientId) {
    const [restored] = await db
      .update(patientsTable)
      .set({ clerkUserId })
      .where(
        and(
          eq(patientsTable.id, priorPatientId),
          isNull(patientsTable.clerkUserId)
        )
      )
      .returning();
    if (restored) {
      logger.info({ clerkUserId, patientId: restored.id }, "[dev] Restored patient link");
      res.json({ role: "patient", patient: { id: restored.id, name: restored.name } });
      return;
    }
  }

  const [existing] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));

  if (existing) {
    res.json({ role: "patient", patient: { id: existing.id, name: existing.name } });
    return;
  }

  const [orphan] = await db
    .select()
    .from(patientsTable)
    .where(
      and(
        isNull(patientsTable.clerkUserId),
        sql`${patientsTable.demographics}->>'devOriginalClerkUserId' = ${clerkUserId}`
      )
    )
    .limit(1);

  if (orphan) {
    const [relinked] = await db
      .update(patientsTable)
      .set({ clerkUserId })
      .where(eq(patientsTable.id, orphan.id))
      .returning();
    res.json({ role: "patient", patient: { id: relinked.id, name: relinked.name } });
    return;
  }

  const [created] = await db
    .insert(patientsTable)
    .values({
      name: "Patient",
      clerkUserId,
      demographics: { devOriginalClerkUserId: clerkUserId } as any,
    })
    .returning();

  logger.info({ clerkUserId, patientId: created.id }, "[dev] Created new patient row on switch-back");
  res.json({ role: "patient", patient: { id: created.id, name: created.name } });
});

export default router;
