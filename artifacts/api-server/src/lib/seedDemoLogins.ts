import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  patientsTable,
  therapistsTable,
  type Patient,
  type Therapist,
} from "@workspace/db";
import { logger } from "./logger";
import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, nameToDemoEmail } from "./demoCredentials";

type SeedRow =
  | { kind: "patient"; row: Patient }
  | { kind: "therapist"; row: Therapist };

/**
 * For each demo patient and demo-roster therapist, ensure a Clerk user
 * exists with a deterministic @anamnesis-demo.com email + the shared demo
 * password, that the email is marked verified (so sign-in skips the
 * email-code prompt), and that the Clerk user id is written back onto
 * the row.
 *
 * Skips:
 *  - therapist rows whose profileAttributes already declare a real
 *    seedEmail (e.g. Dr. Zak Rahman) — those keep their real-account flow
 *  - therapist rows from a non-demo network (real clinicians)
 *
 * Idempotent across server restarts.
 */
export async function seedDemoLogins(): Promise<void> {
  const allPatients = await db.select().from(patientsTable);
  const allTherapists = await db.select().from(therapistsTable);

  const queue: Array<{ row: SeedRow; email: string }> = [];

  for (const p of allPatients) {
    queue.push({ row: { kind: "patient", row: p }, email: nameToDemoEmail(p.name) });
  }

  for (const t of allTherapists) {
    const attrs = (t.profileAttributes ?? {}) as Record<string, unknown>;
    if (typeof attrs.seedEmail === "string" && attrs.seedEmail.length > 0) {
      // Real-account therapist (e.g. Dr. Zak) — leave alone.
      continue;
    }
    const demoEmail = nameToDemoEmail(t.name);
    // Safety: only ever provision into the demo email domain.
    if (!demoEmail.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) continue;
    queue.push({ row: { kind: "therapist", row: t }, email: demoEmail });
  }

  if (queue.length === 0) {
    logger.info("[demo-logins] No demo rows to process");
    return;
  }

  logger.info(
    { total: queue.length, domain: DEMO_EMAIL_DOMAIN },
    "[demo-logins] Reconciling Clerk demo accounts",
  );

  let created = 0;
  let linked = 0;
  let verified = 0;
  let failed = 0;
  let aborted = false;

  for (const { row, email } of queue) {
    if (aborted) break;

    const displayName = row.row.name;
    const existingClerkId =
      row.kind === "patient" ? row.row.clerkUserId : row.row.clerkUserId;

    try {
      // 1. Resolve the Clerk user — by stored id, then by email lookup,
      //    then create as a last resort.
      let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>> | null =
        null;

      if (existingClerkId) {
        try {
          clerkUser = await clerkClient.users.getUser(existingClerkId);
        } catch {
          // Stored id no longer exists in Clerk; fall through to lookup.
          clerkUser = null;
        }
      }

      if (!clerkUser) {
        const found = await clerkClient.users.getUserList({
          emailAddress: [email],
          limit: 1,
        });
        if (found.data.length > 0) {
          clerkUser = found.data[0]!;
          linked++;
        }
      }

      const [first, ...rest] = displayName.replace(/,.*$/, "").trim().split(/\s+/);
      const last = rest.length > 0 ? rest.join(" ") : undefined;

      if (!clerkUser) {
        clerkUser = await clerkClient.users.createUser({
          emailAddress: [email],
          password: DEMO_PASSWORD,
          firstName: first || undefined,
          lastName: last || undefined,
          skipPasswordChecks: true,
          skipPasswordRequirement: false,
        });
        created++;
      } else if (
        (first && clerkUser.firstName !== first) ||
        (last && clerkUser.lastName !== last)
      ) {
        try {
          clerkUser = await clerkClient.users.updateUser(clerkUser.id, {
            firstName: first || undefined,
            lastName: last || undefined,
          });
        } catch (updateErr) {
          const ue = updateErr as { errors?: Array<{ message?: string }>; message?: string };
          logger.warn(
            { email, message: ue.errors?.[0]?.message ?? ue.message },
            "[demo-logins] Could not update user name",
          );
        }
      }

      // 2. Mark every email on this user as verified so the sign-in flow
      //    doesn't ask for an email code.
      for (const ea of clerkUser.emailAddresses) {
        if (ea.verification?.status === "verified") continue;
        try {
          await clerkClient.emailAddresses.updateEmailAddress(ea.id, {
            verified: true,
          });
          verified++;
        } catch (verifyErr) {
          const ve = verifyErr as { errors?: Array<{ message?: string }>; message?: string };
          logger.warn(
            { email: ea.emailAddress, message: ve.errors?.[0]?.message ?? ve.message },
            "[demo-logins] Could not mark email verified",
          );
        }
      }

      // 3. Write clerkUserId back to DB if missing or stale.
      if (existingClerkId !== clerkUser.id) {
        if (row.kind === "patient") {
          await db
            .update(patientsTable)
            .set({ clerkUserId: clerkUser.id })
            .where(eq(patientsTable.id, row.row.id));
        } else {
          await db
            .update(therapistsTable)
            .set({ clerkUserId: clerkUser.id })
            .where(eq(therapistsTable.id, row.row.id));
        }
      }
    } catch (err) {
      failed++;
      const e = err as { errors?: Array<{ message?: string }>; message?: string };
      const message = e.errors?.[0]?.message ?? e.message ?? String(err);

      if (created === 0 && linked === 0) {
        logger.warn(
          { email, kind: row.kind, name: displayName, message },
          "[demo-logins] Aborting demo-login provisioning — Clerk rejected the first attempt (email+password sign-in may be disabled).",
        );
        aborted = true;
      } else {
        logger.warn(
          { email, kind: row.kind, name: displayName, message },
          "[demo-logins] Clerk provisioning failed for one account",
        );
      }
    }
  }

  logger.info(
    { created, linked, verified, failed, aborted },
    "[demo-logins] Reconciliation complete",
  );
}
