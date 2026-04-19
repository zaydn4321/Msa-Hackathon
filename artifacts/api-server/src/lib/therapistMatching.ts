import OpenAI from "openai";
import type { Therapist } from "@workspace/db";

const PROFILE_CATALOG = [
  {
    slug: "complex-ptsd",
    label: "Complex PTSD",
    keywords: [
      "complex trauma", "childhood trauma", "unsafe", "survival mode",
      "hypervigilance", "dissociation", "freeze", "shame",
    ],
  },
  {
    slug: "ptsd",
    label: "PTSD",
    keywords: [
      "trauma", "flashback", "nightmares", "triggered", "avoidance",
      "startle", "panic after",
    ],
  },
  {
    slug: "ocd",
    label: "OCD",
    keywords: [
      "compulsion", "ritual", "checking", "intrusive thoughts",
      "contamination", "obsession", "counting", "reassurance",
    ],
  },
  {
    slug: "anxiety",
    label: "Anxiety",
    keywords: [
      "anxious", "worry", "overthinking", "panic", "nervous",
      "racing thoughts", "can't relax", "edge",
    ],
  },
  {
    slug: "depression",
    label: "Depression",
    keywords: [
      "hopeless", "empty", "numb", "low mood", "can't get out of bed",
      "depressed", "no energy", "worthless",
    ],
  },
  {
    slug: "grief",
    label: "Grief",
    keywords: ["loss", "grief", "mourning", "bereavement", "passed away", "death"],
  },
  {
    slug: "relationship-issues",
    label: "Relationship Issues",
    keywords: [
      "partner", "relationship", "marriage", "boyfriend", "girlfriend",
      "conflict", "attachment", "breakup",
    ],
  },
  {
    slug: "life-transitions",
    label: "Life Transitions",
    keywords: [
      "transition", "new job", "moving", "career change", "divorce",
      "college", "retirement",
    ],
  },
  {
    slug: "burnout",
    label: "Burnout",
    keywords: [
      "burnout", "exhausted", "overworked", "depleted", "no motivation",
      "work stress",
    ],
  },
  {
    slug: "adhd",
    label: "ADHD",
    keywords: [
      "adhd", "attention", "focus", "distracted", "procrastination",
      "impulsive", "executive function",
    ],
  },
  {
    slug: "eating-disorders",
    label: "Eating Disorders",
    keywords: [
      "eating disorder", "restriction", "binge", "purge", "body image",
      "anorexia", "bulimia",
    ],
  },
  {
    slug: "addiction",
    label: "Addiction",
    keywords: [
      "addiction", "substance", "alcohol", "drugs", "recovery",
      "sobriety", "relapse",
    ],
  },
  {
    slug: "identity",
    label: "Identity",
    keywords: [
      "identity", "who am i", "self-concept", "purpose", "belonging",
      "self-worth", "life transitions",
    ],
  },
  {
    slug: "lgbtq",
    label: "LGBTQ+",
    keywords: [
      "gay", "lesbian", "bisexual", "queer", "trans", "nonbinary",
      "gender", "sexuality", "coming out",
    ],
  },
];

export type ProfileInference = {
  slug: string;
  label: string;
  confidence: "high" | "medium" | "low";
};

export async function inferClinicalProfile(transcript: string): Promise<ProfileInference | null> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  const profileList = PROFILE_CATALOG.map((p) => `- ${p.slug}: ${p.label}`).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a clinical intake specialist. Given a patient intake conversation transcript, identify the single most prominent clinical profile.

Available profiles:
${profileList}

Respond with ONLY a JSON object in this exact format:
{"slug": "<profile-slug>", "label": "<profile-label>", "confidence": "high|medium|low"}

If no clear profile is identifiable, respond with null.`,
      },
      {
        role: "user",
        content: `Transcript:\n${transcript.slice(0, 3000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 100,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content || content === "null") return null;

  try {
    return JSON.parse(content) as ProfileInference;
  } catch {
    return null;
  }
}

export type TherapistMatch = {
  therapist: Therapist;
  matchReason: string;
  score: number;
};

function buildMatchReason(therapist: Therapist, profileSlug: string): string {
  const parts: string[] = [];

  const outcomeEntry = therapist.outcomeData?.[profileSlug];
  if (outcomeEntry && outcomeEntry.successRate >= 70) {
    const pct = Math.round(outcomeEntry.successRate);
    const cases = outcomeEntry.caseCount;
    const profileLabel = PROFILE_CATALOG.find((p) => p.slug === profileSlug)?.label ?? profileSlug;
    if (cases >= 100) {
      parts.push(`${pct}% success rate with ${profileLabel} · ${cases} cases`);
    } else {
      parts.push(`${pct}% success rate with ${profileLabel}`);
    }
  }

  const languages = therapist.languages ?? [];
  const nonEnglish = languages.filter((l) => l !== "English");
  if (nonEnglish.length > 0) {
    parts.push(`Speaks ${nonEnglish.slice(0, 2).join(" & ")}`);
  }

  const providerProfile = therapist.providerProfile as { title?: string; location?: string; bio?: string } | null;
  if (providerProfile?.location) {
    const city = providerProfile.location.split(",")[0]?.trim();
    if (city) parts.push(`Based in ${city}`);
  }

  const availability = therapist.availability as { summary?: string } | null;
  if (availability?.summary) {
    const summary = availability.summary;
    if (/this week|available|open/i.test(summary)) {
      parts.push("Available this week");
    } else if (/this month/i.test(summary)) {
      parts.push("Available this month");
    }
  }

  return parts.slice(0, 3).join(" · ") || "Strong clinical match";
}

export function assignTherapistForProfile(
  therapists: Therapist[],
  profileSlug: string,
  count = 3
): TherapistMatch[] {
  const scored = therapists
    .map((t) => {
      const outcomeEntry = t.outcomeData?.[profileSlug];
      const specialtyMatch = t.specialties?.includes(profileSlug) ? 1 : 0;
      const outcomeScore = outcomeEntry
        ? outcomeEntry.successRate * Math.log1p(outcomeEntry.caseCount)
        : 0;

      return {
        therapist: t,
        score: outcomeScore + specialtyMatch * 10,
        matchReason: buildMatchReason(t, profileSlug),
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count);
}
