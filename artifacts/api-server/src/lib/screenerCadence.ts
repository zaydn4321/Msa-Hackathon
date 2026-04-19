import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  intakeSessionsTable,
  screenerResponsesTable,
  screenerRequestsTable,
} from "@workspace/db";
import type { Instrument } from "./screenerCatalog";

export const RESCREEN_INTERVAL_DAYS = Number(process.env.RESCREEN_INTERVAL_DAYS ?? 28);

export type CadenceEntry = {
  instrument: Instrument;
  lastApprovedAt: string | null;
  daysSince: number | null;
  due: boolean;
  hasOpenRequest: boolean;
};

export type PatientCadence = {
  intervalDays: number;
  phq9: CadenceEntry;
  gad7: CadenceEntry;
};

function approvedAtFromBlob(blob: unknown): string | null {
  if (!blob || typeof blob !== "object") return null;
  const v = (blob as { approvedAt?: unknown }).approvedAt;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}

async function lastApprovedFor(
  patientId: number,
  instrument: Instrument,
): Promise<string | null> {
  const sessions = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.patientId, patientId));
  let best: number | null = null;
  for (const s of sessions) {
    const blob = instrument === "phq9" ? s.phq9 : s.gad7;
    const at = approvedAtFromBlob(blob);
    if (at) {
      const t = new Date(at).getTime();
      if (best === null || t > best) best = t;
    }
  }
  const responses = await db
    .select()
    .from(screenerResponsesTable)
    .where(
      and(
        eq(screenerResponsesTable.patientId, patientId),
        eq(screenerResponsesTable.instrument, instrument),
      ),
    )
    .orderBy(desc(screenerResponsesTable.approvedAt));
  for (const r of responses) {
    if (r.approvedAt) {
      const t = new Date(r.approvedAt).getTime();
      if (best === null || t > best) best = t;
      break;
    }
  }
  return best === null ? null : new Date(best).toISOString();
}

async function openRequestInstruments(patientId: number): Promise<Set<Instrument>> {
  const open = await db
    .select({ instrument: screenerRequestsTable.instrument })
    .from(screenerRequestsTable)
    .where(
      and(
        eq(screenerRequestsTable.patientId, patientId),
        inArray(screenerRequestsTable.status, ["pending", "in_progress"]),
      ),
    );
  return new Set(open.map((r) => r.instrument as Instrument));
}

export async function computeCadenceForPatient(
  patientId: number,
  intervalDays: number = RESCREEN_INTERVAL_DAYS,
): Promise<PatientCadence> {
  const open = await openRequestInstruments(patientId);
  const now = Date.now();
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

  const build = async (instrument: Instrument): Promise<CadenceEntry> => {
    const lastApprovedAt = await lastApprovedFor(patientId, instrument);
    const daysSince =
      lastApprovedAt === null
        ? null
        : Math.floor((now - new Date(lastApprovedAt).getTime()) / (24 * 60 * 60 * 1000));
    const due =
      lastApprovedAt === null
        ? true
        : now - new Date(lastApprovedAt).getTime() >= intervalMs;
    return {
      instrument,
      lastApprovedAt,
      daysSince,
      due,
      hasOpenRequest: open.has(instrument),
    };
  };

  const [phq9, gad7] = await Promise.all([build("phq9"), build("gad7")]);
  return { intervalDays, phq9, gad7 };
}

export async function computeCadenceForPatients(
  patientIds: number[],
  intervalDays: number = RESCREEN_INTERVAL_DAYS,
): Promise<Map<number, PatientCadence>> {
  const result = new Map<number, PatientCadence>();
  for (const id of patientIds) {
    result.set(id, await computeCadenceForPatient(id, intervalDays));
  }
  return result;
}
