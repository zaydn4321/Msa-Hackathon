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

async function createTavusConversation(sessionId: number): Promise<{
  conversationId: string;
  conversationUrl: string;
} | null> {
  if (!TAVUS_API_KEY) {
    logger.warn("TAVUS_API_KEY not set — returning null");
    return null;
  }

  const body: Record<string, unknown> = {
    replica_id: TAVUS_REPLICA_ID,
    conversational_context: `You are Sakinah, a warm and empathetic AI intake specialist for Anamnesis, a mental health platform. Your role is to conduct a calm, structured intake conversation with a patient who is seeking therapy. 

Start by warmly welcoming them and explaining you'll be asking a few questions to understand what brings them here today.

Ask open-ended questions covering:
1. What brings them to seek therapy right now
2. How long they've been experiencing these challenges
3. Any previous therapy or mental health treatment
4. Current support systems (family, friends)
5. Their goals — what they hope to achieve through therapy
6. Any specific concerns about starting therapy

Be compassionate and non-judgmental. Keep the conversation focused but let the patient lead. Speak naturally, like a real clinician would. Session ID: ${sessionId}`,
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
    return null;
  }

  const data = await response.json() as { conversation_id: string; conversation_url: string };
  return {
    conversationId: data.conversation_id,
    conversationUrl: data.conversation_url,
  };
}

export async function fetchTavusTranscript(conversationId: string): Promise<string> {
  if (!TAVUS_API_KEY) return "";
  try {
    const res = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}`, {
      headers: { "x-api-key": TAVUS_API_KEY },
    });
    if (!res.ok) return "";
    const data = await res.json() as Record<string, unknown>;

    const raw = data.conversation_transcript;
    if (Array.isArray(raw) && raw.length > 0) {
      return (raw as Array<{ role: string; content: string }>)
        .map((t) => {
          const isPatient = t.role === "user" || t.role === "human";
          return `${isPatient ? "Patient" : "Sakinah"}: ${t.content}`;
        })
        .join("\n");
    }

    if (typeof data.transcript === "string" && data.transcript.length > 0) {
      return data.transcript as string;
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

  if (existing) {
    if (tavus) {
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
      conversationUrl: tavus?.conversationUrl ?? null,
      externalId: tavus?.conversationId ?? null,
    });
    return;
  }

  const [conversation] = await db
    .insert(conversationsTable)
    .values({
      sessionId,
      provider: "tavus",
      externalId: tavus?.conversationId ?? null,
      conversationUrl: tavus?.conversationUrl ?? null,
      status: "active",
    })
    .returning();

  res.status(201).json({
    conversationUrl: conversation.conversationUrl ?? null,
    externalId: conversation.externalId,
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
