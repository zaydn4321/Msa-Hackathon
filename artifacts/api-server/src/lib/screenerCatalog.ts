import type { ScreenerScoreType } from "@workspace/db";

export type Instrument = "phq9" | "gad7";

export const PHQ9_PROMPTS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling/staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving/speaking noticeably slowly, or being fidgety/restless",
  "Thoughts that you would be better off dead, or of hurting yourself",
];

export const GAD7_PROMPTS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

export const RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

export function instrumentLabel(i: Instrument): string {
  return i === "phq9" ? "PHQ-9" : "GAD-7";
}

export function instrumentPrompts(i: Instrument): string[] {
  return i === "phq9" ? PHQ9_PROMPTS : GAD7_PROMPTS;
}

export function phq9Severity(score: number): string {
  if (score >= 20) return "Severe";
  if (score >= 15) return "Moderately severe";
  if (score >= 10) return "Moderate";
  if (score >= 5) return "Mild";
  return "Minimal";
}

export function gad7Severity(score: number): string {
  if (score >= 15) return "Severe";
  if (score >= 10) return "Moderate";
  if (score >= 5) return "Mild";
  return "Minimal";
}

export function severityFor(i: Instrument, score: number): string {
  return i === "phq9" ? phq9Severity(score) : gad7Severity(score);
}

export function scoreFromResponses(
  i: Instrument,
  responses: Record<number, number>,
): ScreenerScoreType {
  const prompts = instrumentPrompts(i);
  const items = prompts.map((prompt, idx) => {
    const raw = Number(responses[idx]);
    const score = Number.isFinite(raw) ? Math.max(0, Math.min(3, Math.round(raw))) : 0;
    return { prompt, score };
  });
  const total = items.reduce((s, it) => s + it.score, 0);
  return {
    score: total,
    maxScore: prompts.length * 3,
    severity: severityFor(i, total),
    rationale: "Patient self-report (re-screen).",
    items,
    approvedAt: null,
    approvedBy: null,
  };
}

// CPT suggestions for psych screeners + therapy session length.
export function suggestCptCodes(instruments: Instrument[]): string[] {
  const codes: string[] = [];
  if (instruments.length > 0) {
    codes.push("96127"); // Brief emotional/behavioral assessment (per instrument)
  }
  codes.push("90834"); // Psychotherapy 45 min
  codes.push("90837"); // Psychotherapy 60 min
  return codes;
}

export const REQUEST_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
