import { db, therapistsTable, patientsTable } from "@workspace/db";
import { logger } from "./lib/logger";

async function seed() {
  logger.info("Seeding database with mock therapists and patients...");

  await db.delete(therapistsTable);
  await db.delete(patientsTable);

  const therapists = await db
    .insert(therapistsTable)
    .values([
      {
        name: "Dr. Evelyn Hart",
        specialties: ["trauma", "ptsd", "complex-ptsd", "dissociation"],
        outcomeData: {
          "complex-ptsd": { successRate: 90, caseCount: 78 },
          ptsd: { successRate: 85, caseCount: 112 },
          ocd: { successRate: 40, caseCount: 22 },
          anxiety: { successRate: 70, caseCount: 45 },
          depression: { successRate: 65, caseCount: 38 },
        },
      },
      {
        name: "Dr. Marcus Chen",
        specialties: ["ocd", "anxiety", "phobias", "intrusive-thoughts"],
        outcomeData: {
          "complex-ptsd": { successRate: 40, caseCount: 15 },
          ptsd: { successRate: 55, caseCount: 28 },
          ocd: { successRate: 92, caseCount: 134 },
          anxiety: { successRate: 88, caseCount: 201 },
          depression: { successRate: 72, caseCount: 89 },
        },
      },
      {
        name: "Dr. Priya Nair",
        specialties: ["depression", "grief", "life-transitions", "relationship-issues"],
        outcomeData: {
          "complex-ptsd": { successRate: 55, caseCount: 31 },
          ptsd: { successRate: 60, caseCount: 44 },
          ocd: { successRate: 50, caseCount: 19 },
          anxiety: { successRate: 75, caseCount: 98 },
          depression: { successRate: 91, caseCount: 167 },
        },
      },
    ])
    .returning();

  logger.info({ count: therapists.length }, "Therapists inserted");
  therapists.forEach((t) => {
    logger.info(`  [${t.id}] ${t.name}`);
  });

  const patients = await db
    .insert(patientsTable)
    .values([
      {
        name: "Alex Rivera",
        demographics: {
          age: 34,
          gender: "non-binary",
          clinicalProfiles: ["complex-ptsd", "depression"],
        },
      },
    ])
    .returning();

  logger.info({ count: patients.length }, "Patients inserted");
  patients.forEach((p) => {
    logger.info(`  [${p.id}] ${p.name}`);
  });

  logger.info("Seed complete. Matchmaking verification:");
  logger.info("  POST /api/match { clinicalProfile: 'complex-ptsd' } -> should return Dr. Evelyn Hart (90%)");
  logger.info("  POST /api/match { clinicalProfile: 'ocd' } -> should return Dr. Marcus Chen (92%)");
  logger.info("  POST /api/match { clinicalProfile: 'depression' } -> should return Dr. Priya Nair (91%)");

  process.exit(0);
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
