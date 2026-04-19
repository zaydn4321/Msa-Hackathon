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
import { requireAuth } from "../middlewares/requireAuth";
import { verifySessionAccess } from "../lib/sessionAccess";

const router: IRouter = Router();

router.get("/therapists", async (_req, res): Promise<void> => {
  const therapists = await ensureTherapistsProvisioned();
  res.json(ListTherapistsResponse.parse(therapists));
});

router.post("/therapists/match", requireAuth, async (req, res): Promise<void> => {
  const body = MatchTherapistBody.parse(req.body);
  const therapists = await ensureTherapistsProvisioned();

  // Preferred path: hydrate matches from the agentic trace persisted on the
  // intake session. This keeps the heavy LLM work off the request path.
  // Trace data contains structured clinical inference (diagnoses, severity,
  // risk flags) so we MUST authorize the caller against the session before
  // returning anything trace-derived.
  if (body.sessionId) {
    const access = await verifySessionAccess(body.sessionId, req.clerkUserId!);
    if (!access.ok) {
      res.status(access.status).json({ error: access.error });
      return;
    }
    const trace = access.session.agentTrace ?? null;
    if (trace && trace.finalMatchIds.length > 0) {
      const tIndex = new Map(therapists.map((t) => [t.id, t]));
      const matches = trace.finalMatchIds
        .map((id) => tIndex.get(id))
        .filter((t): t is (typeof therapists)[number] => !!t);
      const matchReasons: Record<string, string> = {};
      const featureBreakdown: Record<string, unknown> = {};
      const matchExplanations: Record<string, string> = {};
      for (const c of trace.scored) {
        if (!trace.finalMatchIds.includes(c.therapistId)) continue;
        matchReasons[String(c.therapistId)] = c.explanation;
        matchExplanations[String(c.therapistId)] = c.explanation;
        featureBreakdown[String(c.therapistId)] = {
          score: c.score,
          features: c.features,
          critiqueNote: c.critiqueNote ?? null,
          heuristicRank: c.heuristicRank,
          finalRank: c.finalRank,
        };
      }
      res.json(MatchTherapistResponse.parse({
        matches,
        inferredProfile: trace.clinicalProfileV2?.primary.slug ?? body.clinicalProfile,
        matchReasons,
        clinicalProfileV2: trace.clinicalProfileV2 ?? undefined,
        agentTrace: trace,
        matchExplanations,
        featureBreakdown,
      }));
      return;
    }
  }

  // Fallback path: legacy heuristic when no trace is available.
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
