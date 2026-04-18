import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, therapistsTable } from "@workspace/db";
import {
  GetTherapistParams,
  GetTherapistResponse,
  ListTherapistsResponse,
  MatchTherapistBody,
  MatchTherapistResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/therapists", async (_req, res): Promise<void> => {
  const therapists = await db.select().from(therapistsTable);
  res.json(ListTherapistsResponse.parse(therapists));
});

router.get("/therapists/:id", async (req, res): Promise<void> => {
  const params = GetTherapistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.id, params.data.id));

  if (!therapist) {
    res.status(404).json({ error: "Therapist not found" });
    return;
  }

  res.json(GetTherapistResponse.parse(therapist));
});

router.post("/match", async (req, res): Promise<void> => {
  const body = MatchTherapistBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { clinicalProfile } = body.data;

  const therapists = await db.select().from(therapistsTable);

  const candidates = therapists
    .map((t) => {
      const entry = (t.outcomeData as Record<string, { successRate: number; caseCount: number }>)[
        clinicalProfile
      ];
      return { therapist: t, successRate: entry?.successRate ?? null };
    })
    .filter((c) => c.successRate !== null)
    .sort((a, b) => b.successRate! - a.successRate!);

  if (candidates.length === 0) {
    res.status(404).json({ error: `No therapists found with outcome data for profile: ${clinicalProfile}` });
    return;
  }

  const best = candidates[0];
  const response = MatchTherapistResponse.parse({
    therapist: best.therapist,
    successRate: best.successRate,
    explanation: `${best.therapist.name} has the highest documented success rate (${best.successRate}%) for patients with "${clinicalProfile}" based on outcome data across ${(best.therapist.outcomeData as Record<string, { caseCount: number }>)[clinicalProfile]?.caseCount ?? 0} cases.`,
  });

  res.json(response);
});

export default router;
