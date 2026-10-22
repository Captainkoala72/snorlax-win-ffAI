import type { SessionSummary, UiMessage } from "./chat-ui";
import { LEGACY_MODEL, isChatModel, type ChatModel } from "./ai/models";
import { parseImages } from "./images";

export interface LocalChat extends SessionSummary {
  model?: ChatModel;
  messages: UiMessage[];
}

export const chatStorageKey = (leagueId: number, season: number) =>
  `dwi:chats:v1:${leagueId}:${season}`;

export function readChats(storage: Pick<Storage, "getItem">, key: string): LocalChat[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid saved chats"); }
  if (!Array.isArray(parsed)) throw new Error("Invalid saved chats");
  return parsed.filter((chat): chat is LocalChat => {
    if (!chat || !Number.isSafeInteger(chat.id) || typeof chat.title !== "string" ||
      typeof chat.createdAt !== "string" || typeof chat.updatedAt !== "string" || !Array.isArray(chat.messages)) return false;
    return chat.messages.every((m: UiMessage) => m && typeof m.key === "string" &&
      ["user", "assistant"].includes(m.role) && typeof m.content === "string" &&
      (m.toolCalls === undefined || (Array.isArray(m.toolCalls) && m.toolCalls.every((t) =>
        t && typeof t.id === "string" && typeof t.name === "string" && ["running", "ok", "error"].includes(t.status)))));
  }).map((chat) => ({ ...chat, model: isChatModel(chat.model) ? chat.model : LEGACY_MODEL, messages: chat.messages.map((m) => ({
    ...m, ...(m.images ? { images: safeImages(m.images) } : {}), streaming: false,
    error: m.error || Boolean(m.streaming),
  })) })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function safeImages(value: unknown) {
  try { const images = parseImages(value); return images.length ? images : undefined; } catch { return undefined; }
}

export function writeChats(storage: Pick<Storage, "setItem">, key: string, chats: LocalChat[]): void {
  storage.setItem(key, JSON.stringify(chats));
}
