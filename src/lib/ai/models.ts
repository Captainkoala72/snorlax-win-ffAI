// Safe to import in browser components. Provider credentials stay in env.ts.
export const CHAT_MODELS = [
  { id: "glm-5.3-flash", label: "GLM Flash" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
] as const;

export type ChatModel = (typeof CHAT_MODELS)[number]["id"];
export const DEFAULT_MODEL: ChatModel = "glm-5.3-flash";
export function isChatModel(value: unknown): value is ChatModel {
  return CHAT_MODELS.some((model) => model.id === value);
}
