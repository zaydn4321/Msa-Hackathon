export const DEMO_EMAIL_DOMAIN = "anamnesis-demo.com";

export const DEMO_PASSWORD =
  process.env.DEMO_ACCOUNT_PASSWORD || "Anamnesis-Demo-2026";

const ROLE_TITLES = new Set([
  "dr.",
  "dr",
  "mr.",
  "mr",
  "mrs.",
  "mrs",
  "ms.",
  "ms",
  "prof.",
  "prof",
]);

const CREDENTIAL_SUFFIXES = new Set([
  "lcsw",
  "lmft",
  "lpc",
  "mft",
  "psyd",
  "phd",
  "md",
  "ma",
  "ms",
  "mph",
  "ms.",
]);

/**
 * Turn a clinician/patient display name into a deterministic demo email
 * local-part. Strips honorifics ("Dr."), trailing credentials ("LCSW"),
 * keeps first + last word, lowercases, joins with a dot.
 *
 *   "Dr. Evelyn Hart"        -> "evelyn.hart"
 *   "Jordan Ellis, LCSW"     -> "jordan.ellis"
 *   "Vanessa Osei-Kuffour, LMFT" -> "vanessa.osei-kuffour"
 *   "Alex Rivera"            -> "alex.rivera"
 */
export function nameToDemoEmail(name: string): string {
  const beforeComma = name.split(",")[0]!.trim();
  const tokens = beforeComma
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z0-9.'-]/g, ""))
    .filter((t) => t.length > 0)
    .filter((t) => !ROLE_TITLES.has(t.toLowerCase()))
    .filter((t) => !CREDENTIAL_SUFFIXES.has(t.toLowerCase().replace(/\.$/, "")));

  if (tokens.length === 0) {
    return `user.${Math.random().toString(36).slice(2, 8)}@${DEMO_EMAIL_DOMAIN}`;
  }

  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;
  const local = (tokens.length === 1 ? first : `${first}.${last}`)
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "");

  return `${local}@${DEMO_EMAIL_DOMAIN}`;
}

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
