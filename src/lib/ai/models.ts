// Safe to import in browser components. Provider credentials stay in env.ts.
export const CHAT_MODELS = [
  { id: "gpt-6.1-terra", label: "GPT-6.1 Terra" },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
  { id: "mimo-v2.6-pro", label: "MiMo V2.6 Pro" },
  { id: "glm-5.3-flash", label: "GLM Flash" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
] as const;

export type ChatModel = (typeof CHAT_MODELS)[number]["id"];
export const DEFAULT_MODEL: ChatModel = "gpt-6.1-terra";
export const LEGACY_MODEL: ChatModel = "glm-5.3-flash";
export function isChatModel(value: unknown): value is ChatModel {
  return CHAT_MODELS.some((model) => model.id === value);
}

export type OpenAIModel = "gpt-6.1-sol" | "gpt-6.1-terra";
export function isOpenAIModel(value: unknown): value is OpenAIModel {
  return value === "gpt-6.1-sol" || value === "gpt-6.1-terra";
}
export function supportsImageInput(model: ChatModel): boolean {
  return model === "mimo-v2.6-pro" || isOpenAIModel(model);
}
