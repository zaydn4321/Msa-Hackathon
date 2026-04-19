import { pgTable, serial, integer, text, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { therapistsTable } from "./therapists";
import { ScreenerScore } from "./intake_sessions";

export const ScreenerInstrument = z.enum(["phq9", "gad7"]);
export type ScreenerInstrumentType = z.infer<typeof ScreenerInstrument>;

export const ScreenerRequestStatus = z.enum(["pending", "in_progress", "completed", "expired", "cancelled"]);
export type ScreenerRequestStatusType = z.infer<typeof ScreenerRequestStatus>;

export const screenerRequestsTable = pgTable(
  "screener_requests",
  {
    id: serial("id").primaryKey(),
    patientId: integer("patient_id").notNull().references(() => patientsTable.id),
    therapistId: integer("therapist_id").notNull().references(() => therapistsTable.id),
    instrument: text("instrument").$type<ScreenerInstrumentType>().notNull(),
    note: text("note"),
    status: text("status").$type<ScreenerRequestStatusType>().notNull().default("pending"),
    magicToken: text("magic_token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // Auto-saved partial responses while patient is filling out the screener.
    draftResponses: jsonb("draft_responses").$type<Record<number, number>>(),
    // CPT codes the system suggested when the request was created (snapshot).
    cptSuggestions: jsonb("cpt_suggestions").$type<string[]>(),
  },
  (table) => ({
    patientIdx: index("scr_req_patient_idx").on(table.patientId),
    therapistIdx: index("scr_req_therapist_idx").on(table.therapistId),
    statusIdx: index("scr_req_status_idx").on(table.status),
  }),
);

export type ScreenerRequest = typeof screenerRequestsTable.$inferSelect;
export type InsertScreenerRequest = typeof screenerRequestsTable.$inferInsert;

export const screenerResponsesTable = pgTable(
  "screener_responses",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").notNull().references(() => screenerRequestsTable.id).unique(),
    patientId: integer("patient_id").notNull().references(() => patientsTable.id),
    therapistId: integer("therapist_id").notNull().references(() => therapistsTable.id),
    instrument: text("instrument").$type<ScreenerInstrumentType>().notNull(),
    score: jsonb("score").$type<z.infer<typeof ScreenerScore>>().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: integer("approved_by").references(() => therapistsTable.id),
    confirmedCpt: jsonb("confirmed_cpt").$type<string[]>(),
  },
  (table) => ({
    patientIdx: index("scr_resp_patient_idx").on(table.patientId),
    therapistIdx: index("scr_resp_therapist_idx").on(table.therapistId),
  }),
);

export type ScreenerResponse = typeof screenerResponsesTable.$inferSelect;
export type InsertScreenerResponse = typeof screenerResponsesTable.$inferInsert;
