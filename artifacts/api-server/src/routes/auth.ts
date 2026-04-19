import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, patientsTable, therapistsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.clerkUserId, clerkUserId));

  if (patient) {
    res.json({ role: "patient", record: patient });
    return;
  }

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));

  if (therapist) {
    res.json({ role: "therapist", record: therapist });
    return;
  }

  res.json({ role: null, record: null });
});

router.post("/auth/register", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;
  const { role, name, accessCode } = req.body as {
    role: "patient" | "therapist";
    name?: string;
    accessCode?: string;
  };

  if (role === "patient") {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Name is required for patient registration" });
      return;
    }

    const existing = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.clerkUserId, clerkUserId));

    if (existing.length > 0) {
      res.json({ role: "patient", record: existing[0] });
      return;
    }

    const [patient] = await db
      .insert(patientsTable)
      .values({ name: name.trim(), clerkUserId, demographics: {} })
      .returning();

    logger.info({ patientId: patient.id }, "Registered new patient");
    res.status(201).json({ role: "patient", record: patient });
    return;
  }

  if (role === "therapist") {
    if (!accessCode || typeof accessCode !== "string") {
      res.status(400).json({ error: "Access code is required for therapist registration" });
      return;
    }

    const upperCode = accessCode.trim().toUpperCase();

    const [therapist] = await db
      .select()
      .from(therapistsTable)
      .where(
        sql`${therapistsTable.profileAttributes}->>'accessCode' = ${upperCode}`
      );

    if (!therapist) {
      res.status(400).json({ error: "Invalid access code. Please check with your clinic administrator." });
      return;
    }

    if (therapist.clerkUserId && therapist.clerkUserId !== clerkUserId) {
      res.status(409).json({ error: "This access code is already linked to another account." });
      return;
    }

    const [updated] = await db
      .update(therapistsTable)
      .set({ clerkUserId })
      .where(eq(therapistsTable.id, therapist.id))
      .returning();

    logger.info({ therapistId: updated.id }, "Linked therapist account");
    res.json({ role: "therapist", record: updated });
    return;
  }

  res.status(400).json({ error: "Invalid role" });
});

export default router;
