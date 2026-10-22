import type { ChatMessage } from "./ai/prompt";
import { imageBytes, parseImages, type ImageAttachment } from "./images";

/** Client history is untrusted. Never replay client-supplied tools or reasoning. */
export function sanitizeHistory(value: unknown, imageBudget = 0): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: ChatMessage[] = [];
  let remaining = 100000;
  for (const item of value.slice(-40).reverse()) {
    if (!item || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") continue;
    const content = item.content.slice(0, Math.min(20000, remaining));
    let images: ImageAttachment[] = [];
    if (item.role === "user" && imageBudget > 0) {
      try {
        images = parseImages(item.images).filter((image) => {
          const bytes = imageBytes(image);
          if (bytes > imageBudget) return false;
          imageBudget -= bytes;
          return true;
        });
      } catch { /* Ignore malformed historical attachments. */ }
    }
    if (!content && !images?.length) continue;
    messages.unshift({ role: item.role, content, ...(images?.length ? { images } : {}) });
    remaining -= content.length;
    if (remaining <= 0) break;
  }
  return messages;
}
