// Shared UI + SSE helpers for the chat experience.

export interface UiToolCall {
  id: string;
  name: string;
  args: any;
  status: "running" | "ok" | "error";
  summary?: string;
}

export interface UiMessage {
  key: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: UiToolCall[];
  toolName?: string;
  streaming?: boolean;
  error?: boolean;
}

export interface SessionSummary {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function parseSse(raw: string): { event: string; data: any } {
  let event = "message";
  let dataStr = "";
  for (const line of raw.split("\n")) {
    const t = line.trimStart();
    if (t.startsWith("event:")) event = t.slice(6).trim();
    else if (t.startsWith("data:")) dataStr += t.slice(5).trim();
  }
  if (!dataStr) return { event, data: null };
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return { event, data: null };
  }
}

export function safeParseJson(value: unknown): any {
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
