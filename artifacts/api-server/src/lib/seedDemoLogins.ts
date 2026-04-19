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
 * password, then write the resulting Clerk user id back onto the row.
 *
 * Skips:
 *  - rows that already have a clerkUserId set in the DB
 *  - therapist rows whose profileAttributes already declare a real
 *    seedEmail (e.g. Dr. Zak Rahman) — those keep their real-account flow
 *
 * Idempotent across server restarts. A single warning is logged and
 * provisioning short-circuits if Clerk rejects the very first create
 * (e.g. password+email sign-in disabled on the instance).
 */
export async function seedDemoLogins(): Promise<void> {
  const allPatients = await db.select().from(patientsTable);
  const allTherapists = await db.select().from(therapistsTable);

  const queue: Array<{ row: SeedRow; email: string }> = [];

  for (const p of allPatients) {
    if (p.clerkUserId) continue;
    queue.push({ row: { kind: "patient", row: p }, email: nameToDemoEmail(p.name) });
  }

  for (const t of allTherapists) {
    if (t.clerkUserId) continue;
    // Only provision logins for the demo roster — never touch real
    // clinicians from other networks that may exist in mixed environments.
    if (t.networkSource !== "anamnesis-demo") continue;
    const attrs = (t.profileAttributes ?? {}) as Record<string, unknown>;
    if (typeof attrs.seedEmail === "string" && attrs.seedEmail.length > 0) {
      // Real-account therapist (e.g. Dr. Zak) — leave alone.
      continue;
    }
    queue.push({ row: { kind: "therapist", row: t }, email: nameToDemoEmail(t.name) });
  }

  if (queue.length === 0) {
    logger.info("[demo-logins] All demo accounts already provisioned");
    return;
  }

  logger.info(
    { pending: queue.length, domain: DEMO_EMAIL_DOMAIN },
    "[demo-logins] Provisioning Clerk demo accounts",
  );

  let created = 0;
  let linked = 0;
  let failed = 0;
  let aborted = false;

  for (const { row, email } of queue) {
    if (aborted) break;

    const displayName =
      row.kind === "patient" ? row.row.name : row.row.name;

    try {
      // 1. Try to find an existing Clerk user with this email.
      const existing = await clerkClient.users.getUserList({
        emailAddress: [email],
        limit: 1,
      });

      let clerkUserId: string;
      if (existing.data.length > 0) {
        clerkUserId = existing.data[0]!.id;
        linked++;
      } else {
        const [first, ...rest] = displayName.replace(/,.*$/, "").trim().split(/\s+/);
        const last = rest.length > 0 ? rest[rest.length - 1] : undefined;

        const newUser = await clerkClient.users.createUser({
          emailAddress: [email],
          password: DEMO_PASSWORD,
          firstName: first || undefined,
          lastName: last || undefined,
          skipPasswordChecks: true,
          skipPasswordRequirement: false,
        });
        clerkUserId = newUser.id;
        created++;
      }

      // 2. Write back to DB.
      if (row.kind === "patient") {
        await db
          .update(patientsTable)
          .set({ clerkUserId })
          .where(eq(patientsTable.id, row.row.id));
      } else {
        await db
          .update(therapistsTable)
          .set({ clerkUserId })
          .where(eq(therapistsTable.id, row.row.id));
      }
    } catch (err) {
      failed++;
      const e = err as { errors?: Array<{ message?: string }>; message?: string };
      const message =
        e.errors?.[0]?.message ?? e.message ?? String(err);

      // If the very first attempt fails, the Clerk instance likely doesn't
      // support email+password sign-in. Emit one canonical warning and
      // abort so we don't spam logs with 50+ identical errors on every boot.
      if (created === 0 && linked === 0) {
        logger.warn(
          { email, kind: row.kind, name: displayName, message },
          "[demo-logins] Aborting demo-login provisioning — Clerk rejected the first attempt (email+password sign-in may be disabled). Demo directory page will be empty until this is resolved.",
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
    { created, linked, failed, aborted },
    "[demo-logins] Provisioning complete",
  );
}
