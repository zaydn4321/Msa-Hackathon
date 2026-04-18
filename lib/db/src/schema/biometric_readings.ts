import { pgTable, serial, integer, real, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { intakeSessionsTable } from "./intake_sessions";

export const metricTypeEnum = pgEnum("metric_type", ["HR", "HRV"]);

export const biometricReadingsTable = pgTable(
  "biometric_readings",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => intakeSessionsTable.id, { onDelete: "cascade" }),
    metric: metricTypeEnum("metric").notNull(),
    value: real("value").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("biometric_readings_session_id_idx").on(table.sessionId),
    index("biometric_readings_recorded_at_idx").on(table.recordedAt),
  ]
);

export const insertBiometricReadingSchema = createInsertSchema(biometricReadingsTable).omit({
  id: true,
});
export type InsertBiometricReading = z.infer<typeof insertBiometricReadingSchema>;
export type BiometricReading = typeof biometricReadingsTable.$inferSelect;
