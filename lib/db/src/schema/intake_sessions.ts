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
});

export const insertIntakeSessionSchema = createInsertSchema(intakeSessionsTable).omit({ id: true, startedAt: true });
export type InsertIntakeSession = z.infer<typeof insertIntakeSessionSchema>;
export type IntakeSession = typeof intakeSessionsTable.$inferSelect;
