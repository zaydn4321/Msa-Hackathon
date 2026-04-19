import { db, therapistsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Seeds therapist rows that should be claimable by a specific email
 * (auto-linked when that user signs in via Clerk). The therapist will
 * automatically become whoever signs in with the matching email.
 */
const SEEDS: Array<{
  seedEmail: string;
  name: string;
  title: string;
  location: string;
  bio: string;
  specialties: string[];
  modalities: string[];
  languages: string[];
}> = [
  {
    seedEmail: "zakcollegeemail@gmail.com",
    name: "Dr. Zak Rahman",
    title: "Clinical Psychologist · Founder, Anamnesis",
    location: "San Francisco, CA",
    bio: "Founder of Anamnesis. Specializes in trauma-informed care, anxiety, and depression. Brings a structured, evidence-based approach to early-career adults navigating identity, work, and relationships.",
    specialties: ["Anxiety", "Depression", "Trauma", "Burnout"],
    modalities: ["CBT", "ACT", "Trauma-Informed Care"],
    languages: ["English", "Arabic"],
  },
];

export async function seedSpecialTherapists(): Promise<void> {
  for (const seed of SEEDS) {
    const existing = await db
      .select()
      .from(therapistsTable)
      .where(sql`lower(${therapistsTable.profileAttributes}->>'seedEmail') = ${seed.seedEmail.toLowerCase()}`);
    if (existing.length > 0) continue;

    await db.insert(therapistsTable).values({
      name: seed.name,
      providerType: "mental-health",
      networkSource: "anamnesis-seed",
      providerProfile: {
        title: seed.title,
        location: seed.location,
        bio: seed.bio,
      },
      availability: { summary: "Accepting new patients", nextOpenSlot: null },
      languages: seed.languages,
      modalities: seed.modalities,
      careFormats: ["Telehealth", "In-Person"],
      licensedStates: ["CA"],
      specialties: seed.specialties,
      outcomeData: {},
      profileAttributes: { seedEmail: seed.seedEmail },
    });
    logger.info({ seedEmail: seed.seedEmail }, "[seed] inserted special therapist row");
  }
}
