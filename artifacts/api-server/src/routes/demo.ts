import { Router, type IRouter } from "express";
import { db, patientsTable, therapistsTable } from "@workspace/db";
import { isNotNull } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { isDemoEmail } from "../lib/demoCredentials";
import { logger } from "../lib/logger";

const SIGN_IN_TOKEN_TTL_SECONDS = 300;

const router: IRouter = Router();

type DemoAccount = {
  role: "patient" | "therapist";
  recordId: number;
  name: string;
  email: string;
  headline: string;
};

const accountCache: { value: DemoAccount[] | null; loadedAt: number } = {
  value: null,
  loadedAt: 0,
};
const CACHE_TTL_MS = 30_000;

router.get("/demo/accounts", async (_req, res) => {
  const now = Date.now();
  if (accountCache.value && now - accountCache.loadedAt < CACHE_TTL_MS) {
    res.json({ accounts: accountCache.value });
    return;
  }

  try {
    const [patients, therapists] = await Promise.all([
      db.select().from(patientsTable).where(isNotNull(patientsTable.clerkUserId)),
      db.select().from(therapistsTable).where(isNotNull(therapistsTable.clerkUserId)),
    ]);

    // Fetch emails from Clerk for the linked users.
    const allClerkIds = [
      ...patients.map((p) => p.clerkUserId!),
      ...therapists.map((t) => t.clerkUserId!),
    ];

    const emailById = new Map<string, string>();
    // Clerk getUserList limit is 100 per page; chunk if needed.
    const CHUNK = 100;
    for (let i = 0; i < allClerkIds.length; i += CHUNK) {
      const slice = allClerkIds.slice(i, i + CHUNK);
      const list = await clerkClient.users.getUserList({
        userId: slice,
        limit: CHUNK,
      });
      for (const u of list.data) {
        const primary =
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ??
          u.emailAddresses[0];
        if (primary?.emailAddress) {
          emailById.set(u.id, primary.emailAddress.toLowerCase());
        }
      }
    }

    const accounts: DemoAccount[] = [];

    for (const p of patients) {
      const email = emailById.get(p.clerkUserId!);
      if (!email || !isDemoEmail(email)) continue;
      const profiles = p.demographics?.clinicalProfiles ?? [];
      const headline = profiles.length > 0
        ? profiles.slice(0, 2).join(" · ")
        : "Demo patient";
      accounts.push({
        role: "patient",
        recordId: p.id,
        name: p.name,
        email,
        headline,
      });
    }

    for (const t of therapists) {
      const email = emailById.get(t.clerkUserId!);
      if (!email || !isDemoEmail(email)) continue;
      const specialties = t.specialties;
      const profileTitle = typeof t.providerProfile?.title === "string"
        ? t.providerProfile.title
        : "";
      const headline = specialties.length > 0
        ? specialties.slice(0, 3).join(" · ")
        : profileTitle || "Demo therapist";
      accounts.push({
        role: "therapist",
        recordId: t.id,
        name: t.name,
        email,
        headline,
      });
    }

    accounts.sort((a, b) => {
      if (a.role !== b.role) return a.role === "patient" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    accountCache.value = accounts;
    accountCache.loadedAt = now;
    res.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, "Failed to list demo accounts");
    res.json({ accounts: [] });
  }
});

router.post("/demo/sign-in-token", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || !isDemoEmail(email)) {
    res.status(400).json({ error: "Email must be a demo account" });
    return;
  }

  try {
    const list = await clerkClient.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    const user = list.data[0];
    if (!user) {
      res.status(404).json({ error: "No demo account for that email" });
      return;
    }

    const token = await clerkClient.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: SIGN_IN_TOKEN_TTL_SECONDS,
    });

    res.json({ token: token.token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ email, err: message }, "Failed to mint demo sign-in token");
    res.status(500).json({ error: "Could not create sign-in token" });
  }
});

export default router;
