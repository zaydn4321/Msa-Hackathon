# Agentic Therapist Recommendation Pipeline

**Module:** `artifacts/api-server/src/lib/agenticPipeline.ts`
**Pipeline version:** `v2.0.0`
**Entry point:** `runAgenticPipeline(input: PipelineInput): Promise<PipelineResult>`
**Invoked from:** `buildAndPersistBrief()` in `artifacts/api-server/src/routes/sessions.ts`

## What it replaced

Anamnesis previously assigned a therapist via a single LLM call that returned
only a primary clinical profile slug; the assignment ranked therapists by raw
success rate alone. There was no notion of severity, secondary diagnoses,
risk flags, modality fit, language fit, availability, recency, Bayesian
shrinkage, or critique. The user got a one-sentence "match reason" with no way
to see how the system reasoned.

The new pipeline keeps that legacy path as a graceful fallback (see
"Degraded mode" below) while introducing an explicit, multi-stage agentic
workflow whose entire reasoning trace is persisted to the intake session and
surfaced to both patients and clinicians.

## Stages

The pipeline runs as **six explicit tool-using steps**. Each step is logged
via `[agent:<stage>]` console lines and recorded as a `PipelineStep` in the
trace with `status` ∈ {`ok`, `skipped`, `fallback`, `error`}, `durationMs`,
human-readable `summary`, and structured `detail`.

### 1. `plan` — Planner agent

A small LLM call (gpt-4o-mini, `response_format: json_object`) inspects the
inputs (transcript length, biometric reading count, screener presence,
candidate pool size) and emits an ordered subset of subsequent stages plus a
short rationale. Falls back to a deterministic plan when the LLM is
unreachable or the transcript is too short to benefit from planning.

### 2. `infer` — Clinical profile inference v2

A senior-clinician-style LLM call extracts a structured `ClinicalProfileV2`:

```ts
{
  primary:   { slug, label, confidence },
  secondary: [{ slug, label, confidence }] (≤2),
  severity:  "mild" | "moderate" | "severe",
  riskFlags: { suicidalIdeation, selfHarm, substanceUse, crisis },
  axisConfidence: { diagnosis, severity, risk },
  reasoning: string  // 1–3 sentence synthesis
}
```

Slugs are constrained to a fixed catalog. PHQ-9 and GAD-7 totals are passed
inline so severity reflects standardized cutoffs. Risk flags are conservatively
defaulted to `false` and only set true when transcript or screener directly
supports them.

### 3. `retrieve` — Candidate retrieval (deterministic tool)

Hard constraints prune the therapist pool:
- **License region** — patient region must appear in `therapist.licensedStates` if either is known.
- **Language** — at least one overlap with patient language preferences (English assumed otherwise).
- **Capacity** — explicitly closed/full panels are excluded.

For each surviving candidate the stage extracts intermediate features that
will be scored next: specialty/secondary match, language overlap, region
match, severe-case history (count of profiles with ≥70% success), capacity
hint, and the per-profile outcome record.

### 4. `score` — Multi-factor weighted scoring

Eight explicit features, each with an explicit weight, contribute to the
total score (`contribution = weight × normalizedRawValue`):

| Feature           | Weight | Notes |
|-------------------|--------|-------|
| `outcome`         | 1.00   | **Bayesian-shrunk success rate** toward population mean (`shrink C = 25` cases). Therapists with no record for the profile receive a mild penalty against the mean rather than zero. |
| `specialty`       | 0.60   | Primary slug present in `therapist.specialties`. |
| `secondary`       | 0.25   | Any secondary slug present in `therapist.specialties`. |
| `modality`        | 0.20   | Overlap of therapist modalities with the profile-recommended modality list (e.g. EMDR/IFS for complex-PTSD, ERP for OCD). |
| `language`        | 0.30   | Overlap with patient language preferences. |
| `availability`    | 0.25   | `open` (1.0) / `unknown` (0.4) / `limited` (0.0). |
| `severity-fit`    | 0.40   | Severe presentations require a track record of successful severe cases (`min(history/75, 1)`); moderate uses `history/30`; mild defaults to 0.6+. |
| `recency-trend`   | 0.20   | Heuristic from case-count tiers (per-month outcome data not yet captured). |

Each feature contribution is preserved on the `ScoredCandidate` so the UI can
render a per-match breakdown.

### 5. `critique` — Critique / re-rank agent

Top-5 scored candidates plus the `ClinicalProfileV2` are handed to a senior
clinical supervisor LLM that may:
- **reorder** candidates if a lower-ranked one is a better clinical fit,
- **annotate** any candidate with a one-sentence clinician note,
- **veto** a candidate with explicit reasoning (removed from the final list).

The diff (from-rank → to-rank, vetoed, rationale) is preserved on
`trace.critiqueDiff`.

### 6. `synthesize` — Explanation synthesis

For the final 3 matches, an LLM produces a 2–3-sentence patient-readable
rationale grounded **only** in the supplied feature contributions and
critique notes — no invented credentials. If the LLM is unavailable, a
deterministic fallback joins the top three feature notes.

## Persistence (additive)

A new `agent_trace` JSONB column was added to `intake_sessions`
(`lib/db/src/schema/intake_sessions.ts`). The legacy `clinical_brief.clinicalProfile`
field is preserved and continues to be written so older read paths keep
working. **No destructive migrations.** The full trace shape is enforced by
Zod (`AgentTrace` in `@workspace/db`) and surfaced in the OpenAPI spec
(`AgentTrace`, `ClinicalProfileV2`, `PipelineStep`, `FeatureContribution`,
`ScoredCandidate`).

`POST /therapists/match` reads the persisted trace when given a `sessionId`,
returning `clinicalProfileV2`, `agentTrace`, `matchExplanations`, and
`featureBreakdown` alongside the legacy `matches`/`matchReasons` fields.

## Observability

- Every stage logs `[agent:<stage>] <status> (<ms>ms) — <summary>`.
- Orchestrator logs start with input shape and end with final match ids.
- `trace.degraded = true` (with `degradedReason`) is set when any LLM call
  fails and the pipeline falls back. The UI surfaces this prominently.

## Degraded mode

If `OPENAI_API_KEY`/`AI_INTEGRATIONS_OPENAI_API_KEY` is missing, the pipeline
still runs:
- `plan` falls back to the deterministic default plan.
- `infer` returns `null`; defaults are used (`anxiety` / `moderate`).
- `retrieve` and `score` are deterministic and always run.
- `critique` is skipped.
- `synthesize` produces deterministic explanations from the top features.

If the **entire** pipeline throws, `buildAndPersistBrief` falls all the way
back to the legacy `assignTherapistForProfile` heuristic so users still get a
match.

## Where it surfaces in the UI

- `/intake/:sessionId/results` (`artifacts/web-app/src/pages/results.tsx`)
  - **Clinical profile card** — primary + secondary diagnoses, severity badge,
    risk flags, axis-confidence breakdown, clinician reasoning quote.
  - **Agent reasoning timeline** — all 6 stages with status, duration, summary.
  - **"How we matched you"** collapsible panel on each match card with
    weighted feature bars, score, critique note, and re-rank diff.
- The same trace is available to therapists when reviewing a session brief.
