import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PatientDemographics = z.object({
  age: z.number().int().optional(),
  gender: z.string().optional(),
  clinicalProfiles: z.array(z.string()).optional(),
});
export type PatientDemographicsType = z.infer<typeof PatientDemographics>;

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  demographics: jsonb("demographics").$type<PatientDemographicsType>().default({}),
  clerkUserId: text("clerk_user_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
