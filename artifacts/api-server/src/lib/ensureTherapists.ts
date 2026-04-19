import { eq } from "drizzle-orm";
import { db, therapistsTable } from "@workspace/db";
import type { Therapist } from "@workspace/db";
import { therapistRoster } from "./therapistRoster";
import { logger } from "./logger";

export async function ensureTherapistsProvisioned(): Promise<Therapist[]> {
  const existing = await db.select().from(therapistsTable);

  if (existing.length >= therapistRoster.length) {
    return existing;
  }

  const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
  const toInsert = therapistRoster.filter(
    (t) => !existingNames.has(t.name.toLowerCase())
  );

  if (toInsert.length > 0) {
    logger.info({ count: toInsert.length, total: therapistRoster.length }, "Seeding additional therapist roster entries");

    await db.insert(therapistsTable).values(
      toInsert.map((t) => ({
        name: t.name,
        providerType: t.providerType,
        networkSource: t.networkSource,
        providerProfile: {
          title: t.title,
          location: t.location,
          bio: t.bio,
        },
        availability: t.availability,
        languages: t.languages,
        modalities: t.modalities,
        careFormats: t.careFormats,
        licensedStates: t.licensedStates,
        specialties: t.specialties,
        outcomeData: t.outcomeData,
        profileAttributes: {
          ...(t.profileAttributes ?? {}),
          ...(t.accessCode ? { accessCode: t.accessCode } : {}),
        },
      })),
    );
  }

  return db.select().from(therapistsTable);
}

export async function getTherapistById(id: number): Promise<Therapist | null> {
  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.id, id));
  return therapist ?? null;
}
