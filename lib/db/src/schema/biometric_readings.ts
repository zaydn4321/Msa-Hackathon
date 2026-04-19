import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { intakeSessionsTable } from "./intake_sessions";

export const BiometricMetric = z.enum(["HR", "HRV"]);
export type BiometricMetricType = z.infer<typeof BiometricMetric>;

export const biometricReadingsTable = pgTable("biometric_readings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => intakeSessionsTable.id),
  metric: text("metric").notNull().$type<BiometricMetricType>(),
  value: real("value").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").default("watch"),
});

export const insertBiometricReadingSchema = createInsertSchema(biometricReadingsTable).omit({
  id: true,
  recordedAt: true,
});
export type InsertBiometricReading = z.infer<typeof insertBiometricReadingSchema>;
export type BiometricReading = typeof biometricReadingsTable.$inferSelect;
