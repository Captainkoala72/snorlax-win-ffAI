import type { ChatMessage } from "./ai/prompt";

/** Client history is untrusted. Only plain user/assistant text may be replayed. */
export function sanitizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: ChatMessage[] = [];
  let remaining = 100000;
  for (const item of value.slice(-40).reverse()) {
    if (!item || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") continue;
    const content = item.content.slice(0, Math.min(20000, remaining));
    if (!content) continue;
    messages.unshift({ role: item.role, content });
    remaining -= content.length;
    if (remaining <= 0) break;
  }
  return messages;
}
