import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { therapistsTable } from "./therapists";
import { intakeSessionsTable } from "./intake_sessions";

export const MatchStatus = z.enum(["pending", "accepted", "declined"]);
export type MatchStatusType = z.infer<typeof MatchStatus>;

export const patientTherapistMatchesTable = pgTable(
  "patient_therapist_matches",
  {
    id: serial("id").primaryKey(),
    patientId: integer("patient_id").notNull().references(() => patientsTable.id),
    therapistId: integer("therapist_id").notNull().references(() => therapistsTable.id),
    sessionId: integer("session_id").notNull().references(() => intakeSessionsTable.id),
    status: text("status").$type<MatchStatusType>().notNull().default("pending"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => ({
    uniqPatientSessionTherapist: uniqueIndex("uniq_match_patient_session_therapist").on(
      table.patientId,
      table.sessionId,
      table.therapistId,
    ),
  }),
);

export const insertMatchSchema = createInsertSchema(patientTherapistMatchesTable).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});
export type InsertPatientTherapistMatch = z.infer<typeof insertMatchSchema>;
export type PatientTherapistMatch = typeof patientTherapistMatchesTable.$inferSelect;
