import { db, therapistsTable, patientsTable } from "@workspace/db";
import { count } from "drizzle-orm";

export async function getDemoReadiness(): Promise<{
  therapistCount: number;
  patientCount: number;
  ready: boolean;
}> {
  const [{ value: therapistCount }] = await db
    .select({ value: count() })
    .from(therapistsTable);

  const [{ value: patientCount }] = await db
    .select({ value: count() })
    .from(patientsTable);

  return {
    therapistCount: Number(therapistCount),
    patientCount: Number(patientCount),
    ready: Number(therapistCount) > 0,
  };
}
