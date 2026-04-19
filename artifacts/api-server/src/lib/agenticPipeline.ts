import OpenAI from "openai";
import type {
  AgentTraceType,
  BiometricReading,
  ClinicalProfileV2Type,
  FeatureContributionType,
  PipelineStepType,
  ScoredCandidateType,
  ScreenerScoreType,
  Therapist,
} from "@workspace/db";

const PIPELINE_VERSION = "v2.0.0";

const PROFILE_CATALOG: Array<{ slug: string; label: string }> = [
  { slug: "complex-ptsd", label: "Complex PTSD" },
  { slug: "ptsd", label: "PTSD" },
  { slug: "ocd", label: "OCD" },
  { slug: "anxiety", label: "Anxiety" },
  { slug: "depression", label: "Depression" },
  { slug: "grief", label: "Grief" },
  { slug: "relationship-issues", label: "Relationship Issues" },
  { slug: "life-transitions", label: "Life Transitions" },
  { slug: "burnout", label: "Burnout" },
  { slug: "adhd", label: "ADHD" },
  { slug: "eating-disorders", label: "Eating Disorders" },
  { slug: "addiction", label: "Addiction" },
  { slug: "identity", label: "Identity" },
  { slug: "lgbtq", label: "LGBTQ+" },
];

function labelForSlug(slug: string): string {
  return PROFILE_CATALOG.find((p) => p.slug === slug)?.label ?? slug;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

function log(stage: string, msg: string, extra?: Record<string, unknown>) {
  const tail = extra ? " " + JSON.stringify(extra) : "";
  console.log(`[agent:${stage}] ${msg}${tail}`);
}

export interface PipelineInput {
  sessionId: number;
  transcript: string;
  biometrics: BiometricReading[];
  phq9: ScreenerScoreType | null;
  gad7: ScreenerScoreType | null;
  therapists: Therapist[];
  patientLanguagePreferences?: string[];
  patientRegion?: string | null;
  topN?: number;
}

export interface PipelineResult {
  trace: AgentTraceType;
  primaryProfile: string | null;
  matches: Array<{ therapistId: number; explanation: string; score: number; features: FeatureContributionType[] }>;
}

interface BiometricSummary {
  averageHr: number | null;
  peakHr: number | null;
  averageHrv: number | null;
  sympatheticActivation: "low" | "moderate" | "elevated" | "unknown";
  readingCount: number;
}

function summarizeBiometrics(readings: BiometricReading[]): BiometricSummary {
  const hr = readings.filter((r) => r.metric === "HR");
  const hrv = readings.filter((r) => r.metric === "HRV");
  const averageHr = hr.length ? hr.reduce((s, r) => s + r.value, 0) / hr.length : null;
  const peakHr = hr.length ? Math.max(...hr.map((r) => r.value)) : null;
  const averageHrv = hrv.length ? hrv.reduce((s, r) => s + r.value, 0) / hrv.length : null;

  let sympathetic: BiometricSummary["sympatheticActivation"] = "unknown";
  if (averageHr != null && peakHr != null) {
    const surge = peakHr - averageHr;
    if (averageHr > 95 || surge > 30) sympathetic = "elevated";
    else if (averageHr > 80 || surge > 18) sympathetic = "moderate";
    else sympathetic = "low";
  }
  return { averageHr, peakHr, averageHrv, sympatheticActivation: sympathetic, readingCount: readings.length };
}

// ----- Stage 1: Planner ------------------------------------------------------

interface PlannerOutput {
  plan: string[];
  rationale: string;
}

async function runPlanner(
  openai: OpenAI | null,
  input: PipelineInput,
  bio: BiometricSummary,
): Promise<PlannerOutput> {
  const transcriptLen = input.transcript.trim().length;
  const hasTranscript = transcriptLen > 20;
  const hasBio = bio.readingCount > 0;
  const hasScreeners = !!(input.phq9 || input.gad7);

  // Deterministic baseline plan — every stage runs unless inputs are missing.
  const plan: string[] = ["infer-profile"];
  if (input.therapists.length > 0) plan.push("retrieve-candidates", "score-candidates");
  if (plan.includes("score-candidates")) plan.push("critique-rerank", "synthesize-explanations");

  let rationale =
    `Transcript length=${transcriptLen} chars; biometric readings=${bio.readingCount} (${bio.sympatheticActivation}); screeners=${hasScreeners ? "present" : "absent"}.`;

  if (!openai || !hasTranscript) {
    return { plan, rationale: rationale + " Using deterministic plan (no LLM planner)." };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
`You are an orchestration planner inside a multi-stage clinical recommendation agent. Given the metadata about the inputs available for one intake session, decide WHICH downstream stages to run and briefly say why. Do not invent capabilities.

Available stages (always in this order if included):
- infer-profile: extract structured clinical profile (primary/secondary/severity/risk)
- retrieve-candidates: filter therapist pool by hard constraints
- score-candidates: multi-factor weighted scoring with feature breakdown
- critique-rerank: senior-clinician LLM second opinion that may reorder/veto
- synthesize-explanations: per-match patient-readable rationale

Respond with JSON: {"plan":["..."],"rationale":"<1-2 sentences>"}.
Skip stages only when their inputs are clearly missing.`,
        },
        {
          role: "user",
          content:
`Inputs:
- transcriptLengthChars: ${transcriptLen} (hasTranscript=${hasTranscript})
- biometric readings: ${bio.readingCount} (sympathetic=${bio.sympatheticActivation})
- PHQ-9 present: ${!!input.phq9}; GAD-7 present: ${!!input.gad7}
- Therapist pool size: ${input.therapists.length}

Default plan if you have no objection: ${JSON.stringify(plan)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });
    const txt = completion.choices[0]?.message?.content?.trim();
    if (txt) {
      const parsed = JSON.parse(txt) as Partial<PlannerOutput>;
      if (Array.isArray(parsed.plan) && parsed.plan.length > 0) {
        const allowed = new Set([
          "infer-profile",
          "retrieve-candidates",
          "score-candidates",
          "critique-rerank",
          "synthesize-explanations",
        ]);
        const cleaned = parsed.plan.filter((s) => allowed.has(s));
        if (cleaned.length > 0) {
          return { plan: cleaned, rationale: parsed.rationale ?? rationale };
        }
      }
    }
  } catch (err) {
    log("planner", "LLM planner failed, using deterministic plan", { err: String(err) });
  }
  return { plan, rationale };
}

// ----- Stage 2: Clinical Profile Inference v2 -------------------------------

async function inferClinicalProfileV2(
  openai: OpenAI | null,
  input: PipelineInput,
  bio: BiometricSummary,
): Promise<ClinicalProfileV2Type | null> {
  if (!openai) return null;
  const transcript = input.transcript.trim();
  if (transcript.length <= 20) return null;

  const profileList = PROFILE_CATALOG.map((p) => `- ${p.slug}: ${p.label}`).join("\n");
  const phq9Line = input.phq9
    ? `PHQ-9: total ${input.phq9.score}/${input.phq9.maxScore} (${input.phq9.severity})`
    : "PHQ-9: not available";
  const gad7Line = input.gad7
    ? `GAD-7: total ${input.gad7.score}/${input.gad7.maxScore} (${input.gad7.severity})`
    : "GAD-7: not available";
  const bioLine = bio.readingCount
    ? `Biometrics: avg HR ${bio.averageHr?.toFixed(0)} bpm, peak ${bio.peakHr?.toFixed(0)} bpm, avg HRV ${bio.averageHrv?.toFixed(0) ?? "N/A"} ms — sympathetic activation ${bio.sympatheticActivation}.`
    : "Biometrics: not captured.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
`You are a senior clinical psychologist extracting a structured intake profile. Use only the supporting evidence in the transcript and screeners. Return STRICT JSON matching this schema:

{
  "primary": {"slug":"<one of catalog slugs>","label":"<label>","confidence":0..1},
  "secondary": [ up to 2 entries with same shape ],
  "severity": "mild" | "moderate" | "severe",
  "riskFlags": {
    "suicidalIdeation": boolean,
    "selfHarm": boolean,
    "substanceUse": boolean,
    "crisis": boolean
  },
  "axisConfidence": {
    "diagnosis": 0..1,
    "severity": 0..1,
    "risk": 0..1
  },
  "reasoning": "1-3 sentence clinician-style synthesis"
}

Catalog of allowed slugs:
${profileList}

Severity guidance: factor PHQ-9 (≥15 severe, ≥10 moderate) and GAD-7 (≥15 severe, ≥10 moderate) when present, then weigh transcript impairment.
Risk flags must be true ONLY when transcript or screener directly supports them; otherwise false.
Do not invent diagnoses outside the catalog. JSON only — no prose.`,
        },
        {
          role: "user",
          content:
`${phq9Line}
${gad7Line}
${bioLine}

Transcript:
${transcript.slice(0, 12000)}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClinicalProfileV2Type;
    // Normalize/clamp
    const valid = new Set(PROFILE_CATALOG.map((p) => p.slug));
    if (!parsed.primary || !valid.has(parsed.primary.slug)) return null;
    parsed.primary.label = labelForSlug(parsed.primary.slug);
    parsed.primary.confidence = Math.max(0, Math.min(1, Number(parsed.primary.confidence) || 0.5));
    parsed.secondary = (parsed.secondary || [])
      .filter((s) => s && valid.has(s.slug) && s.slug !== parsed.primary.slug)
      .slice(0, 2)
      .map((s) => ({
        slug: s.slug,
        label: labelForSlug(s.slug),
        confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0.3)),
      }));
    if (!["mild", "moderate", "severe"].includes(parsed.severity)) parsed.severity = "moderate";
    parsed.riskFlags = {
      suicidalIdeation: !!parsed.riskFlags?.suicidalIdeation,
      selfHarm: !!parsed.riskFlags?.selfHarm,
      substanceUse: !!parsed.riskFlags?.substanceUse,
      crisis: !!parsed.riskFlags?.crisis,
    };
    parsed.axisConfidence = {
      diagnosis: Math.max(0, Math.min(1, Number(parsed.axisConfidence?.diagnosis) || 0.5)),
      severity: Math.max(0, Math.min(1, Number(parsed.axisConfidence?.severity) || 0.5)),
      risk: Math.max(0, Math.min(1, Number(parsed.axisConfidence?.risk) || 0.5)),
    };
    parsed.reasoning = parsed.reasoning?.toString() ?? "";
    return parsed;
  } catch (err) {
    log("infer-profile", "LLM extraction failed", { err: String(err) });
    return null;
  }
}

// ----- Stage 3: Candidate Retrieval -----------------------------------------

interface RetrievalOptions {
  primarySlug: string;
  secondarySlugs: string[];
  severity: "mild" | "moderate" | "severe";
  languagePreferences: string[];
  region: string | null;
}

interface CandidateFeatures {
  therapist: Therapist;
  hasSpecialty: boolean;
  hasSecondary: boolean;
  languageOverlap: number;
  regionMatch: boolean | null;
  severeCaseHistory: number;
  capacityHint: "open" | "limited" | "unknown";
  outcomeForProfile: { successRate: number; caseCount: number } | null;
}

function retrieveCandidates(
  therapists: Therapist[],
  opts: RetrievalOptions,
): { shortlist: CandidateFeatures[]; pruned: number } {
  const shortlist: CandidateFeatures[] = [];
  let pruned = 0;
  for (const t of therapists) {
    // Hard constraint: capacity (availability summary mentioning closed/full).
    const summary = (t.availability?.summary ?? "").toLowerCase();
    const capacityHint: CandidateFeatures["capacityHint"] = /full|closed|wait/.test(summary)
      ? "limited"
      : /this week|available|open|next week/.test(summary)
        ? "open"
        : "unknown";
    if (capacityHint === "limited" && /closed|full/.test(summary)) {
      pruned++;
      continue;
    }
    // Hard constraint: licensed region (if patient region known).
    if (opts.region && t.licensedStates && t.licensedStates.length > 0) {
      const region = opts.region.toUpperCase();
      const licensed = t.licensedStates.map((s) => s.toUpperCase());
      if (!licensed.includes(region)) {
        pruned++;
        continue;
      }
    }
    // Hard constraint: required language (if any specified).
    if (opts.languagePreferences.length > 0) {
      const langs = (t.languages ?? []).map((l) => l.toLowerCase());
      const overlap = opts.languagePreferences.filter((l) => langs.includes(l.toLowerCase()));
      if (overlap.length === 0 && !langs.includes("english")) {
        pruned++;
        continue;
      }
    }

    const langs = (t.languages ?? []).map((l) => l.toLowerCase());
    const languageOverlap = opts.languagePreferences.length === 0
      ? langs.includes("english") ? 1 : 0
      : opts.languagePreferences.filter((l) => langs.includes(l.toLowerCase())).length;

    const hasSpecialty = !!t.specialties?.includes(opts.primarySlug);
    const hasSecondary = (t.specialties ?? []).some((s) => opts.secondarySlugs.includes(s));
    const outcomeForProfile = t.outcomeData?.[opts.primarySlug] ?? null;

    // "Severe case history" — sum of caseCount across any profile where success ≥ 70.
    // Used as a fit signal for severe presentations.
    const severeCaseHistory = Object.values(t.outcomeData ?? {})
      .filter((o) => o && o.successRate >= 70)
      .reduce((s, o) => s + o.caseCount, 0);

    const regionMatch = opts.region
      ? (t.licensedStates ?? []).map((s) => s.toUpperCase()).includes(opts.region.toUpperCase())
      : null;

    shortlist.push({
      therapist: t,
      hasSpecialty,
      hasSecondary,
      languageOverlap,
      regionMatch,
      severeCaseHistory,
      capacityHint,
      outcomeForProfile,
    });
  }
  return { shortlist, pruned };
}

// ----- Stage 4: Multi-factor Scoring ----------------------------------------

const WEIGHTS = {
  outcome: 1.0,
  specialty: 0.6,
  secondary: 0.25,
  modality: 0.2,
  language: 0.3,
  availability: 0.25,
  severityFit: 0.4,
  recencyTrend: 0.2,
};

const MODALITY_FOR_PROFILE: Record<string, string[]> = {
  "complex-ptsd": ["EMDR", "IFS", "Somatic Experiencing", "Trauma-Focused CBT"],
  "ptsd": ["EMDR", "Trauma-Focused CBT", "Prolonged Exposure"],
  "ocd": ["ERP", "CBT"],
  "anxiety": ["CBT", "ACT", "Mindfulness-Based"],
  "depression": ["CBT", "Behavioral Activation", "IPT"],
  "grief": ["Grief-Focused", "Meaning-Centered", "ACT"],
  "burnout": ["CBT", "ACT", "Mindfulness-Based"],
  "adhd": ["CBT", "Coaching", "Behavioral"],
  "eating-disorders": ["CBT-E", "FBT", "DBT"],
  "addiction": ["MI", "CBT", "12-Step"],
  "relationship-issues": ["Gottman", "EFT", "IFS"],
  "life-transitions": ["ACT", "Narrative", "CBT"],
  "identity": ["Narrative", "ACT", "Person-Centered"],
  "lgbtq": ["Affirmative", "Narrative", "ACT"],
};

function scoreCandidate(
  c: CandidateFeatures,
  populationMean: number,
  severity: "mild" | "moderate" | "severe",
): { score: number; features: FeatureContributionType[]; recencyTrend: number } {
  const features: FeatureContributionType[] = [];

  // Bayesian-shrunk success rate: shrink toward population mean by case count.
  // shrink factor C controls how aggressively we trust low-case-count therapists.
  const C = 25;
  const cases = c.outcomeForProfile?.caseCount ?? 0;
  const successRate = c.outcomeForProfile?.successRate ?? 0;
  const shrunk =
    cases > 0
      ? (successRate * cases + populationMean * C) / (cases + C)
      : populationMean * 0.6; // mild penalty for "no cases at all"
  // Normalize 0..100 -> 0..1 contribution then weight.
  const outcomeContribution = (shrunk / 100) * WEIGHTS.outcome;
  features.push({
    feature: "outcome",
    label: "Outcome record (Bayesian-shrunk)",
    weight: WEIGHTS.outcome,
    rawValue: Math.round(shrunk * 10) / 10,
    contribution: round(outcomeContribution),
    note: cases > 0
      ? `${Math.round(successRate)}% across ${cases} cases → shrunk to ${Math.round(shrunk)}%`
      : `No prior cases for this profile; shrunk toward population mean (${Math.round(populationMean)}%)`,
  });

  // Specialty exact match.
  const specialtyContribution = c.hasSpecialty ? WEIGHTS.specialty : 0;
  features.push({
    feature: "specialty",
    label: "Primary specialty match",
    weight: WEIGHTS.specialty,
    rawValue: c.hasSpecialty ? 1 : 0,
    contribution: round(specialtyContribution),
  });

  // Secondary specialty match.
  const secondaryContribution = c.hasSecondary ? WEIGHTS.secondary : 0;
  features.push({
    feature: "secondary",
    label: "Secondary diagnosis coverage",
    weight: WEIGHTS.secondary,
    rawValue: c.hasSecondary ? 1 : 0,
    contribution: round(secondaryContribution),
  });

  // Modality fit (uses inferred profile via context — passed implicitly).
  // Caller passes preferred modalities through the candidate features object's
  // therapist.modalities list; we score by intersection elsewhere. Here we
  // approximate using the therapist's modality list overlap with profile-recommended ones.

  // Language match.
  const langContribution = c.languageOverlap > 0 ? WEIGHTS.language : 0;
  features.push({
    feature: "language",
    label: "Language fit",
    weight: WEIGHTS.language,
    rawValue: c.languageOverlap,
    contribution: round(langContribution),
  });

  // Availability fit.
  const availMap = { open: 1, unknown: 0.4, limited: 0 };
  const availRaw = availMap[c.capacityHint];
  const availContribution = availRaw * WEIGHTS.availability;
  features.push({
    feature: "availability",
    label: "Availability window",
    weight: WEIGHTS.availability,
    rawValue: availRaw,
    contribution: round(availContribution),
    note: `Capacity signal: ${c.capacityHint}`,
  });

  // Severity fit: severe presentations prefer therapists with ≥75 successful severe cases.
  let severityFitRaw = 0.5;
  if (severity === "severe") severityFitRaw = Math.min(1, c.severeCaseHistory / 75);
  else if (severity === "moderate") severityFitRaw = Math.min(1, c.severeCaseHistory / 30);
  else severityFitRaw = c.severeCaseHistory > 0 ? 1 : 0.6;
  const severityContribution = severityFitRaw * WEIGHTS.severityFit;
  features.push({
    feature: "severity-fit",
    label: `Severity fit (${severity})`,
    weight: WEIGHTS.severityFit,
    rawValue: round(severityFitRaw),
    contribution: round(severityContribution),
    note: `${c.severeCaseHistory} successful cases on file across all profiles`,
  });

  // Recency trend: we have no per-month data, so degrade gracefully.
  // Heuristic: large case volume implies stable recent activity.
  const recencyTrend = cases > 50 ? 0.8 : cases > 10 ? 0.5 : cases > 0 ? 0.3 : 0;
  const recencyContribution = recencyTrend * WEIGHTS.recencyTrend;
  features.push({
    feature: "recency-trend",
    label: "Recent outcome trend",
    weight: WEIGHTS.recencyTrend,
    rawValue: round(recencyTrend),
    contribution: round(recencyContribution),
    note: "Heuristic from case volume; per-month data not available",
  });

  const total = features.reduce((s, f) => s + f.contribution, 0);
  return { score: round(total), features, recencyTrend };
}

function applyModalityFit(
  features: FeatureContributionType[],
  therapist: Therapist,
  primarySlug: string,
): { features: FeatureContributionType[]; delta: number } {
  const recommended = MODALITY_FOR_PROFILE[primarySlug] ?? [];
  if (recommended.length === 0) return { features, delta: 0 };
  const therapistModalities = (therapist.modalities ?? []).map((m) => m.toLowerCase());
  const overlap = recommended.filter((r) => therapistModalities.some((t) => t.includes(r.toLowerCase())));
  const raw = overlap.length / recommended.length;
  const contribution = round(raw * WEIGHTS.modality);
  const next = [...features, {
    feature: "modality",
    label: "Modality fit for profile",
    weight: WEIGHTS.modality,
    rawValue: round(raw),
    contribution,
    note: overlap.length
      ? `Trained in ${overlap.join(", ")}`
      : `No overlap with recommended (${recommended.slice(0, 3).join(", ")}…)`,
  }];
  return { features: next, delta: contribution };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function populationMeanSuccess(therapists: Therapist[], slug: string): number {
  const entries = therapists
    .map((t) => t.outcomeData?.[slug])
    .filter((e): e is { successRate: number; caseCount: number } => !!e && e.caseCount > 0);
  if (entries.length === 0) return 65; // sane default
  const totalCases = entries.reduce((s, e) => s + e.caseCount, 0);
  const weighted = entries.reduce((s, e) => s + e.successRate * e.caseCount, 0);
  return weighted / totalCases;
}

// ----- Stage 5: Critique / re-rank -----------------------------------------

interface CritiqueOutput {
  reordered: number[]; // therapist ids in new order
  notes: Record<string, string>; // therapistId -> note
  vetoes: number[]; // therapist ids removed
  rationale: string;
}

async function runCritique(
  openai: OpenAI | null,
  profile: ClinicalProfileV2Type | null,
  scored: ScoredCandidateType[],
): Promise<CritiqueOutput | null> {
  if (!openai || scored.length < 2 || !profile) return null;
  const top = scored.slice(0, 5);
  const candidatesPayload = top.map((c) => ({
    therapistId: c.therapistId,
    therapistName: c.therapistName,
    score: c.score,
    features: c.features.map((f) => ({ feature: f.feature, contribution: f.contribution, note: f.note })),
  }));
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
`You are a senior clinical supervisor reviewing a junior algorithm's top therapist matches. Look at the patient's structured profile and the candidate features. You may:
- reorder candidates if a lower-ranked one is a meaningfully better fit
- annotate any candidate with a 1-sentence clinical rationale
- veto a candidate (remove from final list) only when a clear mismatch exists with reasoning

Return strict JSON:
{
  "reordered": [<therapistId>, ...],
  "notes": {"<therapistId>": "<short clinician note>"},
  "vetoes": [<therapistId>, ...],
  "rationale": "<1-3 sentence explanation of any changes>"
}
If you would not change anything, return the original order with empty notes/vetoes and rationale="No changes — heuristic ranking aligns with clinical judgment."`,
        },
        {
          role: "user",
          content:
`Patient profile:
${JSON.stringify(profile, null, 2)}

Candidates (in current heuristic order):
${JSON.stringify(candidatesPayload, null, 2)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CritiqueOutput;
    const validIds = new Set(top.map((t) => t.therapistId));
    parsed.reordered = (parsed.reordered ?? []).filter((id) => validIds.has(Number(id))).map(Number);
    parsed.vetoes = (parsed.vetoes ?? []).filter((id) => validIds.has(Number(id))).map(Number);
    parsed.notes = parsed.notes ?? {};
    parsed.rationale = parsed.rationale?.toString() ?? "";
    if (parsed.reordered.length === 0) parsed.reordered = top.map((t) => t.therapistId);
    return parsed;
  } catch (err) {
    log("critique", "LLM critique failed", { err: String(err) });
    return null;
  }
}

// ----- Stage 6: Explanation Synthesis ---------------------------------------

async function synthesizeExplanations(
  openai: OpenAI | null,
  profile: ClinicalProfileV2Type | null,
  finalCandidates: ScoredCandidateType[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!openai || !profile) {
    for (const c of finalCandidates) out.set(c.therapistId, fallbackExplanation(c));
    return out;
  }
  try {
    const payload = finalCandidates.map((c) => ({
      therapistId: c.therapistId,
      therapistName: c.therapistName,
      features: c.features,
      critiqueNote: c.critiqueNote,
    }));
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
`You write short patient-readable "why this therapist" paragraphs. ONLY use the supplied features and critique note. Do not invent credentials, locations, fees, or specialties. 2-3 sentences max each. Plain warm language, second person.

Return strict JSON: {"<therapistId>": "paragraph", ...}`,
        },
        {
          role: "user",
          content:
`Patient primary concern: ${profile.primary.label} (${profile.severity}).
Secondary: ${profile.secondary.map((s) => s.label).join(", ") || "none"}.

Candidates:
${JSON.stringify(payload, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const c of finalCandidates) {
        const text = parsed[String(c.therapistId)];
        if (text && typeof text === "string" && text.trim().length > 0) {
          out.set(c.therapistId, text.trim());
        } else {
          out.set(c.therapistId, fallbackExplanation(c));
        }
      }
      return out;
    }
  } catch (err) {
    log("synthesize", "LLM explanation failed; using fallback", { err: String(err) });
  }
  for (const c of finalCandidates) out.set(c.therapistId, fallbackExplanation(c));
  return out;
}

function fallbackExplanation(c: ScoredCandidateType): string {
  const top = [...c.features].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  const parts = top.map((f) => f.note ?? f.label);
  return `${c.therapistName} ranked here primarily because: ${parts.join("; ")}.`;
}

// ----- Orchestrator ---------------------------------------------------------

export async function runAgenticPipeline(input: PipelineInput): Promise<PipelineResult> {
  const openai = getOpenAI();
  const bio = summarizeBiometrics(input.biometrics);
  const steps: PipelineStepType[] = [];
  const t0 = Date.now();
  log("orchestrator", `Pipeline ${PIPELINE_VERSION} starting for session=${input.sessionId}`, {
    therapistPool: input.therapists.length,
    transcriptChars: input.transcript.length,
    biometrics: bio.readingCount,
  });

  function record(stage: string, label: string, started: number, status: PipelineStepType["status"], summary: string, detail?: unknown) {
    const step: PipelineStepType = {
      stage,
      label,
      startedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
      status,
      summary,
      detail,
    };
    steps.push(step);
    log(stage, `${status} (${step.durationMs}ms) — ${summary}`);
  }

  // -- Stage 1: Planner --------------------------------------------------
  let stageStart = Date.now();
  const planner = await runPlanner(openai, input, bio);
  record("plan", "Planner", stageStart, "ok",
    `Plan: ${planner.plan.join(" → ")}`,
    { plan: planner.plan, rationale: planner.rationale });

  let degraded = false;
  let degradedReason: string | undefined;

  // -- Stage 2: Profile inference ----------------------------------------
  stageStart = Date.now();
  let profile: ClinicalProfileV2Type | null = null;
  if (planner.plan.includes("infer-profile")) {
    profile = await inferClinicalProfileV2(openai, input, bio);
    if (profile) {
      const risks = Object.entries(profile.riskFlags).filter(([, v]) => v).map(([k]) => k);
      record("infer", "Clinical profile inference v2", stageStart, "ok",
        `${profile.primary.label} (${profile.severity}); secondary=${profile.secondary.map((s) => s.label).join(", ") || "none"}; risks=${risks.join(", ") || "none"}`,
        { profile });
    } else {
      record("infer", "Clinical profile inference v2", stageStart, "fallback",
        "Profile extraction unavailable — falling back to legacy");
      degraded = true;
      degradedReason = "Profile extraction LLM unavailable";
    }
  } else {
    record("infer", "Clinical profile inference v2", stageStart, "skipped", "Skipped by planner");
  }

  const primarySlug = profile?.primary.slug ?? "anxiety";
  const secondarySlugs = profile?.secondary.map((s) => s.slug) ?? [];
  const severity = profile?.severity ?? "moderate";

  // -- Stage 3: Candidate retrieval -------------------------------------
  stageStart = Date.now();
  const retrieval = retrieveCandidates(input.therapists, {
    primarySlug,
    secondarySlugs,
    severity,
    languagePreferences: input.patientLanguagePreferences ?? [],
    region: input.patientRegion ?? null,
  });
  record("retrieve", "Candidate retrieval", stageStart, "ok",
    `Pool=${input.therapists.length}, shortlist=${retrieval.shortlist.length}, pruned=${retrieval.pruned}`,
    { shortlistIds: retrieval.shortlist.map((c) => c.therapist.id), pruned: retrieval.pruned });

  // -- Stage 4: Multi-factor scoring ------------------------------------
  stageStart = Date.now();
  const popMean = populationMeanSuccess(input.therapists, primarySlug);
  const scoredAll: ScoredCandidateType[] = retrieval.shortlist.map((c) => {
    const base = scoreCandidate(c, popMean, severity);
    const withMod = applyModalityFit(base.features, c.therapist, primarySlug);
    const finalScore = round(base.score + withMod.delta);
    return {
      therapistId: c.therapist.id,
      therapistName: c.therapist.name,
      heuristicRank: 0, // filled after sort
      finalRank: 0,
      score: finalScore,
      features: withMod.features,
      explanation: "",
    };
  }).sort((a, b) => b.score - a.score)
    .map((c, i) => ({ ...c, heuristicRank: i + 1, finalRank: i + 1 }));

  record("score", "Multi-factor scoring", stageStart, "ok",
    `Top 3 scores: ${scoredAll.slice(0, 3).map((s) => `${s.therapistName.split(" ")[1] ?? s.therapistName}=${s.score}`).join(", ")}`,
    { populationMeanSuccessRate: round(popMean), topIds: scoredAll.slice(0, 5).map((s) => s.therapistId) });

  // -- Stage 5: Critique / re-rank --------------------------------------
  stageStart = Date.now();
  let critiqueDiff: AgentTraceType["critiqueDiff"] = [];
  if (planner.plan.includes("critique-rerank")) {
    const critique = await runCritique(openai, profile, scoredAll);
    if (critique) {
      const before = scoredAll.slice(0, 5).map((s) => s.therapistId);
      const after = critique.reordered.filter((id) => !critique.vetoes.includes(id));
      // Apply notes
      for (const c of scoredAll) {
        if (critique.notes[String(c.therapistId)]) c.critiqueNote = critique.notes[String(c.therapistId)];
        if (critique.vetoes.includes(c.therapistId)) c.vetoed = true;
      }
      // Reorder top section to match critique
      const idToCandidate = new Map(scoredAll.map((c) => [c.therapistId, c]));
      const reorderedTop: ScoredCandidateType[] = [];
      for (const id of after) {
        const found = idToCandidate.get(id);
        if (found) reorderedTop.push(found);
      }
      const remaining = scoredAll.filter((c) => !after.includes(c.therapistId));
      const newOrder = [...reorderedTop, ...remaining];
      newOrder.forEach((c, i) => (c.finalRank = i + 1));
      // Diff
      critiqueDiff = before.map((id, i) => {
        const newPos = newOrder.findIndex((c) => c.therapistId === id);
        const wasVetoed = critique.vetoes.includes(id);
        return {
          therapistId: id,
          from: i + 1,
          to: wasVetoed ? null : newPos + 1,
          rationale: critique.notes[String(id)] ?? (wasVetoed ? "Vetoed by critique agent" : (i + 1 === newPos + 1 ? "Position unchanged" : "Reordered by critique agent")),
        };
      });
      // Replace scored array order
      scoredAll.length = 0;
      scoredAll.push(...newOrder);
      record("critique", "Critique / re-rank", stageStart, "ok",
        critique.rationale || "Critique applied",
        { critiqueDiff, vetoes: critique.vetoes });
    } else {
      record("critique", "Critique / re-rank", stageStart, "fallback",
        "Critique LLM unavailable — keeping heuristic order");
    }
  } else {
    record("critique", "Critique / re-rank", stageStart, "skipped", "Skipped by planner");
  }

  // -- Stage 6: Explanation synthesis ----------------------------------
  stageStart = Date.now();
  const finalTop = scoredAll.filter((c) => !c.vetoed).slice(0, input.topN ?? 3);
  const explanations = await synthesizeExplanations(openai, profile, finalTop);
  for (const c of scoredAll) {
    const exp = explanations.get(c.therapistId);
    if (exp) c.explanation = exp;
    else if (!c.explanation) c.explanation = fallbackExplanation(c);
  }
  record("synthesize", "Explanation synthesis", stageStart, openai && profile ? "ok" : "fallback",
    `Generated explanations for ${finalTop.length} matches`);

  // -- Finalize ---------------------------------------------------------
  const trace: AgentTraceType = {
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    degraded,
    degradedReason,
    plan: planner.plan,
    planRationale: planner.rationale,
    steps,
    clinicalProfileV2: profile,
    candidatePoolSize: input.therapists.length,
    shortlistSize: retrieval.shortlist.length,
    scored: scoredAll,
    finalMatchIds: finalTop.map((c) => c.therapistId),
    critiqueDiff: critiqueDiff && critiqueDiff.length > 0 ? critiqueDiff : undefined,
  };

  log("orchestrator", `Pipeline complete in ${Date.now() - t0}ms`, {
    finalMatchIds: trace.finalMatchIds,
    degraded,
  });

  return {
    trace,
    primaryProfile: profile?.primary.slug ?? null,
    matches: finalTop.map((c) => ({
      therapistId: c.therapistId,
      explanation: c.explanation,
      score: c.score,
      features: c.features,
    })),
  };
}

// Convenience export for quick fallback path that just reads the persisted trace.
export function pickFinalMatchesFromTrace(trace: AgentTraceType): ScoredCandidateType[] {
  return trace.scored.filter((c) => trace.finalMatchIds.includes(c.therapistId)).sort(
    (a, b) => trace.finalMatchIds.indexOf(a.therapistId) - trace.finalMatchIds.indexOf(b.therapistId),
  );
}
