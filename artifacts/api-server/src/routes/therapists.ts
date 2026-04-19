import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, therapistsTable } from "@workspace/db";
import {
  ListTherapistsResponse,
  MatchTherapistBody,
  MatchTherapistResponse,
  GetTherapistParams,
  GetTherapistResponse,
} from "@workspace/api-zod";
import { assignTherapistForProfile } from "../lib/therapistMatching";
import { ensureTherapistsProvisioned } from "../lib/ensureTherapists";

const router: IRouter = Router();

router.get("/therapists", async (_req, res): Promise<void> => {
  const therapists = await ensureTherapistsProvisioned();
  res.json(ListTherapistsResponse.parse(therapists));
});

router.post("/therapists/match", async (req, res): Promise<void> => {
  const body = MatchTherapistBody.parse(req.body);
  const therapists = await ensureTherapistsProvisioned();
  const matchResults = assignTherapistForProfile(therapists, body.clinicalProfile, 3);

  const matches = matchResults.map((r) => r.therapist);
  const matchReasons: Record<string, string> = {};
  for (const r of matchResults) {
    matchReasons[String(r.therapist.id)] = r.matchReason;
  }

  res.json(MatchTherapistResponse.parse({
    matches,
    inferredProfile: body.clinicalProfile,
    matchReasons,
  }));
});

router.get("/therapists/:therapistId", async (req, res): Promise<void> => {
  const { therapistId } = GetTherapistParams.parse(req.params);
  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.id, therapistId));

  if (!therapist) {
    res.status(404).json({ error: "Therapist not found" });
    return;
  }

  res.json(GetTherapistResponse.parse(therapist));
});

export default router;
