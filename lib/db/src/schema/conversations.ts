import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { intakeSessionsTable } from "./intake_sessions";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => intakeSessionsTable.id),
  externalId: text("external_id"),
  conversationUrl: text("conversation_url"),
  provider: text("provider").notNull().default("tavus"),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({
  id: true,
  startedAt: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
