import { eq } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import { logger } from "./logger";
import { ensureTherapistsProvisioned } from "./ensureTherapists";
import { seedSpecialTherapists } from "./seedSpecialTherapists";
import { seedDemoMatches } from "./seedDemoMatches";

const demoPatients = [
  {
    name: "Alex Rivera",
    demographics: {
      age: 34,
      gender: "non-binary",
      clinicalProfiles: ["complex-ptsd", "depression"],
    },
  },
  {
    name: "Mina Thompson",
    demographics: {
      age: 28,
      gender: "female",
      clinicalProfiles: ["anxiety", "burnout"],
    },
  },
];

export async function bootstrapDemoData() {
  const therapists = await ensureTherapistsProvisioned();
  await seedSpecialTherapists();

  for (const patient of demoPatients) {
    const [existing] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.name, patient.name));

    if (!existing) {
      await db.insert(patientsTable).values(patient);
      continue;
    }

    const demographicsChanged =
      JSON.stringify(existing.demographics ?? {}) !==
      JSON.stringify(patient.demographics);

    if (demographicsChanged) {
      await db
        .update(patientsTable)
        .set({ demographics: patient.demographics })
        .where(eq(patientsTable.id, existing.id));
    }
  }

  await seedDemoMatches();

  logger.info(
    { therapistCount: therapists.length, demoPatientCount: demoPatients.length },
    "Demo bootstrap ensured",
  );
}
