import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  conversationsTable,
  intakeSessionsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { verifySessionAccess } from "../lib/sessionAccess";

const router: IRouter = Router();

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_PERSONA_ID = process.env.TAVUS_PERSONA_ID;
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID ?? "rd3ba0f30551";

type TavusFailure = { error: string; status?: number; detail?: string };

async function createTavusConversation(sessionId: number): Promise<
  | { conversationId: string; conversationUrl: string }
  | TavusFailure
> {
  if (!TAVUS_API_KEY) {
    logger.warn("TAVUS_API_KEY not set");
    return { error: "TAVUS_API_KEY is not configured on the server." };
  }

  const body: Record<string, unknown> = {
    replica_id: TAVUS_REPLICA_ID,
    conversational_context: `You are Sakinah, an empathetic AI intake specialist for Anamnesis, a mental health platform conducting a structured pre-therapy intake.

VOICE & STYLE — these rules are absolute:
- Speak in ONE short sentence at a time. Never two sentences in a row.
- Ask ONE question per turn. Never stack questions.
- Maximum ~20 spoken words per turn. Brevity is the entire job.
- Do NOT lecture, summarize, validate at length, or restate what the patient said.
- Acknowledge briefly if needed ("I hear you.") then ask the next single question.
- No filler, no preambles ("That's a great point", "I appreciate you sharing"), no closing remarks.
- Wait for the patient to fully answer before speaking again.

OPENING (single sentence):
"Hi, I'm Sakinah — what brings you in today?"

THEN cover these areas, one short question at a time, in roughly this order, adapting to what they say:
- onset and duration of the concern
- frequency and severity
- impact on sleep, work, relationships
- prior therapy or medication
- support system
- substance use (brief, neutral)
- safety: any thoughts of self-harm
- what they hope to get from therapy

CLOSE (single sentence) when they've covered the basics:
"Thank you — I have what I need; a clinician will review your intake shortly."

Session ID: ${sessionId}`,
  };

  if (TAVUS_PERSONA_ID) body.persona_id = TAVUS_PERSONA_ID;

  const response = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TAVUS_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Tavus conversation creation failed");
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      detail = parsed.message ?? parsed.error ?? text;
    } catch {
      // keep raw text
    }
    let friendly = `Tavus error (${response.status}): ${detail}`;
    if (response.status === 402 || /credit|quota|billing|insufficient|exceeded/i.test(detail)) {
      friendly = "Tavus account is out of credits or has hit a usage limit.";
    } else if (response.status === 401 || response.status === 403) {
      friendly = "Tavus rejected the API key.";
    } else if (response.status === 429) {
      friendly = "Tavus rate limit reached — try again in a moment.";
    }
    return { error: friendly, status: response.status, detail };
  }

  const data = await response.json() as { conversation_id: string; conversation_url: string };
  return {
    conversationId: data.conversation_id,
    conversationUrl: data.conversation_url,
  };
}

type TavusTranscriptItem = { role?: string; content?: string };
type TavusEvent = {
  event_type?: string;
  properties?: { transcript?: TavusTranscriptItem[] };
};

function formatTranscript(items: TavusTranscriptItem[]): string {
  return items
    // The first item is typically the system prompt (role "system") — skip it.
    .filter((t) => t.role && t.role !== "system" && typeof t.content === "string" && t.content.trim().length > 0)
    .map((t) => {
      const role = (t.role ?? "").toLowerCase();
      const isPatient = role === "user" || role === "human";
      return `${isPatient ? "Patient" : "Sakinah"}: ${t.content!.trim()}`;
    })
    .join("\n");
}

export async function fetchTavusTranscript(conversationId: string): Promise<string> {
  if (!TAVUS_API_KEY) return "";
  try {
    // The transcript lives in events[].properties.transcript and is ONLY
    // returned when verbose=true is set on the GET. Without verbose, the
    // events array is omitted entirely.
    const res = await fetch(
      `https://tavusapi.com/v2/conversations/${conversationId}?verbose=true`,
      { headers: { "x-api-key": TAVUS_API_KEY } }
    );
    if (!res.ok) return "";
    const data = (await res.json()) as Record<string, unknown> & {
      events?: TavusEvent[];
      conversation_transcript?: TavusTranscriptItem[];
      transcript?: string | TavusTranscriptItem[];
    };

    if (Array.isArray(data.events)) {
      const transcriptionEvent = data.events.find(
        (e) => e.event_type === "application.transcription_ready"
      );
      const items = transcriptionEvent?.properties?.transcript;
      if (Array.isArray(items) && items.length > 0) {
        const formatted = formatTranscript(items);
        if (formatted.length > 0) return formatted;
      }
    }

    if (Array.isArray(data.conversation_transcript) && data.conversation_transcript.length > 0) {
      const formatted = formatTranscript(data.conversation_transcript);
      if (formatted.length > 0) return formatted;
    }

    if (typeof data.transcript === "string" && data.transcript.length > 0) {
      return data.transcript;
    }
    if (Array.isArray(data.transcript) && data.transcript.length > 0) {
      const formatted = formatTranscript(data.transcript);
      if (formatted.length > 0) return formatted;
    }

    logger.info({ conversationId, status: data.status }, "Tavus transcript not yet available");
    return "";
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Tavus transcript");
    return "";
  }
}

router.post("/sessions/:sessionId/tavus", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId as string, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const access = await verifySessionAccess(sessionId, req.clerkUserId!);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  if (access.role !== "patient") {
    res.status(403).json({ error: "Only the patient may initiate a Tavus session" });
    return;
  }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  if (existing?.conversationUrl) {
    res.json({
      conversationUrl: existing.conversationUrl,
      externalId: existing.externalId,
      alreadyExists: true,
    });
    return;
  }

  const tavus = await createTavusConversation(sessionId);
  const tavusOk = tavus !== null && "conversationId" in tavus;
  const tavusErr = !tavusOk ? (tavus as TavusFailure) : null;

  if (existing) {
    if (tavusOk) {
      await db
        .update(conversationsTable)
        .set({
          externalId: tavus.conversationId,
          conversationUrl: tavus.conversationUrl,
          status: "active",
        })
        .where(eq(conversationsTable.id, existing.id));
    }
    res.json({
      conversationUrl: tavusOk ? tavus.conversationUrl : null,
      externalId: tavusOk ? tavus.conversationId : null,
      error: tavusErr?.error ?? null,
    });
    return;
  }

  const [conversation] = await db
    .insert(conversationsTable)
    .values({
      sessionId,
      provider: "tavus",
      externalId: tavusOk ? tavus.conversationId : null,
      conversationUrl: tavusOk ? tavus.conversationUrl : null,
      status: "active",
    })
    .returning();

  res.status(201).json({
    conversationUrl: conversation.conversationUrl ?? null,
    externalId: conversation.externalId,
    error: tavusErr?.error ?? null,
  });
});

router.delete("/sessions/:sessionId/tavus", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId as string, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const access = await verifySessionAccess(sessionId, req.clerkUserId!);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  if (access.role !== "patient") {
    res.status(403).json({ error: "Only the patient may end a Tavus session" });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  if (!conversation?.externalId || !TAVUS_API_KEY) {
    res.json({ ok: true });
    return;
  }

  try {
    await fetch(`https://tavusapi.com/v2/conversations/${conversation.externalId}`, {
      method: "DELETE",
      headers: { "x-api-key": TAVUS_API_KEY },
    });
  } catch (err) {
    logger.warn({ err }, "Tavus conversation deletion failed (non-fatal)");
  }

  await db
    .update(conversationsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(conversationsTable.id, conversation.id));

  res.json({ ok: true });
});

export default router;
