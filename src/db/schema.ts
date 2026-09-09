import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Each session is scoped to a league so multiple leagues stay fully separated.
export const chatSession = pgTable("chat_session", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  leagueId: text("league_id").notNull().default("default"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Full OpenAI-shaped message payload is stored as JSONB so history can be
// replayed verbatim into the model on the next turn.
export const chatMessage = pgTable("chat_message", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSession.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant | tool
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatSessionRow = typeof chatSession.$inferSelect;
export type ChatMessageRow = typeof chatMessage.$inferSelect;
