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

export const ProviderType = z.enum(["mental-health", "physical-therapy"]);
export type ProviderTypeType = z.infer<typeof ProviderType>;

export const ProviderProfile = z.object({
  title: z.string(),
  location: z.string(),
  bio: z.string(),
});
export type ProviderProfileType = z.infer<typeof ProviderProfile>;

export const ProviderAvailability = z.object({
  summary: z.string(),
  nextOpenSlot: z.string().nullable().optional(),
});
export type ProviderAvailabilityType = z.infer<typeof ProviderAvailability>;

export const ProviderProfileAttributes = z.record(z.string(), z.unknown());
export type ProviderProfileAttributesType = z.infer<typeof ProviderProfileAttributes>;

export const therapistsTable = pgTable("therapists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clerkUserId: text("clerk_user_id").unique(),
  providerType: text("provider_type").notNull().$type<ProviderTypeType>().default("mental-health"),
  networkSource: text("network_source").notNull().default("anamnesis-demo"),
  providerProfile: jsonb("provider_profile")
    .$type<ProviderProfileType>()
    .notNull()
    .default({ title: "", location: "", bio: "" }),
  availability: jsonb("availability")
    .$type<ProviderAvailabilityType>()
    .notNull()
    .default({ summary: "" }),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  modalities: jsonb("modalities").$type<string[]>().notNull().default([]),
  careFormats: jsonb("care_formats").$type<string[]>().notNull().default([]),
  licensedStates: jsonb("licensed_states").$type<string[]>().notNull().default([]),
  specialties: jsonb("specialties").$type<string[]>().notNull().default([]),
  outcomeData: jsonb("outcome_data").$type<OutcomeDataType>().notNull().default({}),
  profileAttributes: jsonb("profile_attributes")
    .$type<ProviderProfileAttributesType>()
    .default({}),
});

export const insertTherapistSchema = createInsertSchema(therapistsTable).omit({ id: true });
export type InsertTherapist = z.infer<typeof insertTherapistSchema>;
export type Therapist = typeof therapistsTable.$inferSelect;
