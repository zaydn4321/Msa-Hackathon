import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { therapistsTable } from "./therapists";
import { patientsTable } from "./patients";

export const ClinicalBriefObjective = z.object({
  averageHr: z.number().nullable(),
  averageHrv: z.number().nullable(),
  peakHr: z.number().nullable(),
  readingCount: z.number().int(),
  biometricSubtextEvents: z.array(
    z.object({
      transcriptSegmentId: z.string(),
      timestamp: z.date(),
      hrValue: z.number(),
      baselineHr: z.number(),
      spikePercent: z.number(),
      text: z.string(),
    }),
  ),
});
export type ClinicalBriefObjectiveType = z.infer<typeof ClinicalBriefObjective>;

export const ClinicalBrief = z.object({
  sessionId: z.number().int(),
  generatedAt: z.date(),
  subjective: z.string(),
  objective: ClinicalBriefObjective,
  assessment: z.string(),
  plan: z.string(),
  clinicalProfile: z.string().optional(),
});
export type ClinicalBriefType = z.infer<typeof ClinicalBrief>;

// Agentic pipeline trace — additive JSON store. Schema is intentionally loose
// so iterations on the pipeline don't require destructive migrations.
export const ClinicalProfileV2 = z.object({
  primary: z.object({
    slug: z.string(),
    label: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  secondary: z.array(
    z.object({
      slug: z.string(),
      label: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  severity: z.enum(["mild", "moderate", "severe"]),
  riskFlags: z.object({
    suicidalIdeation: z.boolean(),
    selfHarm: z.boolean(),
    substanceUse: z.boolean(),
    crisis: z.boolean(),
  }),
  axisConfidence: z.object({
    diagnosis: z.number().min(0).max(1),
    severity: z.number().min(0).max(1),
    risk: z.number().min(0).max(1),
  }),
  reasoning: z.string(),
});
export type ClinicalProfileV2Type = z.infer<typeof ClinicalProfileV2>;

export const PipelineStep = z.object({
  stage: z.string(),
  label: z.string(),
  startedAt: z.string(),
  durationMs: z.number(),
  status: z.enum(["ok", "skipped", "fallback", "error"]),
  summary: z.string(),
  detail: z.unknown().optional(),
});
export type PipelineStepType = z.infer<typeof PipelineStep>;

export const FeatureContribution = z.object({
  feature: z.string(),
  label: z.string(),
  weight: z.number(),
  rawValue: z.number(),
  contribution: z.number(),
  note: z.string().optional(),
});
export type FeatureContributionType = z.infer<typeof FeatureContribution>;

export const ScoredCandidate = z.object({
  therapistId: z.number().int(),
  therapistName: z.string(),
  heuristicRank: z.number().int(),
  finalRank: z.number().int(),
  score: z.number(),
  features: z.array(FeatureContribution),
  explanation: z.string(),
  critiqueNote: z.string().optional(),
  vetoed: z.boolean().optional(),
});
export type ScoredCandidateType = z.infer<typeof ScoredCandidate>;

export const AgentTrace = z.object({
  pipelineVersion: z.string(),
  generatedAt: z.string(),
  degraded: z.boolean(),
  degradedReason: z.string().optional(),
  plan: z.array(z.string()),
  planRationale: z.string().optional(),
  steps: z.array(PipelineStep),
  clinicalProfileV2: ClinicalProfileV2.nullable(),
  candidatePoolSize: z.number().int(),
  shortlistSize: z.number().int(),
  scored: z.array(ScoredCandidate),
  finalMatchIds: z.array(z.number().int()),
  critiqueDiff: z
    .array(
      z.object({
        therapistId: z.number().int(),
        from: z.number().int(),
        to: z.number().int().nullable(),
        rationale: z.string(),
      }),
    )
    .optional(),
});
export type AgentTraceType = z.infer<typeof AgentTrace>;

export const ScreenerEditHistoryEntry = z.object({
  editedAt: z.string(),
  editedBy: z.number().int(),
  itemIndex: z.number().int().nullable(),
  field: z.enum(["score", "rationale"]),
  fromValue: z.union([z.string(), z.number()]).nullable(),
  toValue: z.union([z.string(), z.number()]).nullable(),
});
export type ScreenerEditHistoryEntryType = z.infer<typeof ScreenerEditHistoryEntry>;

export const ScreenerScore = z.object({
  score: z.number().int().min(0),
  maxScore: z.number().int().min(0),
  severity: z.string(),
  rationale: z.string(),
  items: z
    .array(
      z.object({
        prompt: z.string(),
        score: z.number().int().min(0).max(3),
        evidence: z.string().optional(),
      }),
    )
    .optional(),
  approvedAt: z.string().nullable().optional(),
  approvedBy: z.number().int().nullable().optional(),
  approvalNote: z.string().nullable().optional(),
  editHistory: z.array(ScreenerEditHistoryEntry).optional(),
});
export type ScreenerScoreType = z.infer<typeof ScreenerScore>;

export const intakeSessionsTable = pgTable("intake_sessions", {
  id: serial("id").primaryKey(),
  label: text("label"),
  patientId: integer("patient_id").references(() => patientsTable.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  clinicalBrief: jsonb("clinical_brief").$type<ClinicalBriefType>(),
  assignedTherapistId: integer("assigned_therapist_id").references(() => therapistsTable.id),
  phq9: jsonb("phq9").$type<ScreenerScoreType>(),
  gad7: jsonb("gad7").$type<ScreenerScoreType>(),
  agentTrace: jsonb("agent_trace").$type<AgentTraceType>(),
});

export const insertIntakeSessionSchema = createInsertSchema(intakeSessionsTable).omit({ id: true, startedAt: true });
export type InsertIntakeSession = z.infer<typeof insertIntakeSessionSchema>;
export type IntakeSession = typeof intakeSessionsTable.$inferSelect;
