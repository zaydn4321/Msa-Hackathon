import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import {
  db,
  conversationsTable,
  messagesTable,
  intakeSessionsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { verifySessionAccess } from "../lib/sessionAccess";

const router: IRouter = Router();

export async function getConversationTranscript(sessionId: number): Promise<string> {
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  if (!conversation) return "";

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(asc(messagesTable.createdAt));

  return messages.map((m) => `${m.role === "user" ? "Patient" : "Sakinah"}: ${m.content}`).join("\n");
}

router.post("/sessions/:sessionId/conversation", requireAuth, async (req, res): Promise<void> => {
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
    res.status(403).json({ error: "Only the patient may start a conversation" });
    return;
  }

  const [existingConversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  if (existingConversation) {
    res.json({ conversationId: existingConversation.id, externalId: existingConversation.externalId });
    return;
  }

  const [conversation] = await db
    .insert(conversationsTable)
    .values({ sessionId, provider: "tavus" })
    .returning();

  res.status(201).json({ conversationId: conversation.id, externalId: null });
});

router.get("/sessions/:sessionId/conversation", requireAuth, async (req, res): Promise<void> => {
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

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(asc(messagesTable.createdAt));

  res.json({ conversation, messages });
});

router.post("/sessions/:sessionId/conversation/messages", requireAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId as string, 10);
  const { role, content } = req.body ?? {};

  if (!role || !content) {
    res.status(400).json({ error: "role and content are required" });
    return;
  }

  const access = await verifySessionAccess(sessionId, req.clerkUserId!);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  if (access.role !== "patient") {
    res.status(403).json({ error: "Only the patient may post conversation messages" });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.sessionId, sessionId));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({ conversationId: conversation.id, role, content })
    .returning();

  res.status(201).json(message);
});

export default router;
