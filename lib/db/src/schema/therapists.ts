import { pgTable, serial, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const OutcomeDataEntry = z.object({
  successRate: z.number().min(0).max(100),
  caseCount: z.number().int().min(0),
});
export type OutcomeDataEntryType = z.infer<typeof OutcomeDataEntry>;

export const OutcomeData = z.record(z.string(), OutcomeDataEntry);
export type OutcomeDataType = z.infer<typeof OutcomeData>;

export const therapistsTable = pgTable("therapists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialties: jsonb("specialties").notNull().$type<string[]>().default([]),
  outcomeData: jsonb("outcome_data").notNull().$type<OutcomeDataType>().default({}),
});

export const insertTherapistSchema = createInsertSchema(therapistsTable).omit({
  id: true,
});
export type InsertTherapist = z.infer<typeof insertTherapistSchema>;
export type Therapist = typeof therapistsTable.$inferSelect;
