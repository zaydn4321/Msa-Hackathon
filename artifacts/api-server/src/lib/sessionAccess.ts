import { eq } from "drizzle-orm";
import {
  db,
  intakeSessionsTable,
  patientsTable,
  therapistsTable,
  type IntakeSession,
} from "@workspace/db";

export type SessionAccessRole = "patient" | "therapist";

export type SessionAccessResult =
  | { ok: true; role: SessionAccessRole; session: IntakeSession }
  | { ok: false; status: 403 | 404; error: string };

/**
 * Verifies that the Clerk user identified by clerkUserId has access to the given session.
 *
 * Access is granted if:
 *  - The caller is the registered patient whose patientId matches session.patientId
 *  - The caller is the therapist specifically assigned to this session
 *    (session.assignedTherapistId === therapist.id); unassigned sessions are
 *    not visible to any therapist.
 *
 * Returns the session object on success to avoid duplicate DB lookups.
 */
export async function verifySessionAccess(
  sessionId: number,
  clerkUserId: string,
): Promise<SessionAccessResult> {
  const [session] = await db
    .select()
    .from(intakeSessionsTable)
    .where(eq(intakeSessionsTable.id, sessionId));

  if (!session) {
    return { ok: false, status: 404, error: "Session not found" };
  }

  if (session.patientId !== null) {
    const [patient] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.clerkUserId, clerkUserId));

    if (patient && patient.id === session.patientId) {
      return { ok: true, role: "patient", session };
    }
  }

  if (session.assignedTherapistId !== null) {
    const [therapist] = await db
      .select()
      .from(therapistsTable)
      .where(eq(therapistsTable.clerkUserId, clerkUserId));

    if (therapist && therapist.id === session.assignedTherapistId) {
      return { ok: true, role: "therapist", session };
    }
  }

  return { ok: false, status: 403, error: "Access denied" };
}
