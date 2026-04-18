import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const intakeSessionsTable = pgTable("intake_sessions", {
  id: serial("id").primaryKey(),
  label: text("label"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  soapNotes: jsonb("soap_notes").$type<{ subjective: string; assessment: string; plan: string } | null>(),
});

export const insertIntakeSessionSchema = createInsertSchema(intakeSessionsTable).omit({
  id: true,
  startedAt: true,
});
export type InsertIntakeSession = z.infer<typeof insertIntakeSessionSchema>;
export type IntakeSession = typeof intakeSessionsTable.$inferSelect;
