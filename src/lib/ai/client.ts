// Z.AI API client (OpenAI-compatible surface) for GLM-5.3-Flash.
// Streams chat completions and runs the function-tool loop server-side.

import { env, type ReasoningEffort } from "../env";
import type { ToolDef } from "./tools";
import type { ChatMessage } from "./prompt";

export interface ChatCallbacks {
  onStart?: (info: { model: string; effort: ReasoningEffort }) => void;
  onDelta?: (delta: string) => void;
  onToolCall?: (id: string, name: string, args: any) => void;
  onToolResult?: (id: string, name: string, ok: boolean, summary: string) => void;
}

export interface RunChatOptions {
  messages: ChatMessage[];
  effort: ReasoningEffort;
  webSearch: boolean;
  tools: ToolDef[];
  executeTool: (name: string, args: any) => Promise<string>;
  callbacks?: ChatCallbacks;
}

interface ToolCallAccumulator {
  id: string;
  name: string;
  args: string;
}

const MAX_TOOL_ITERATIONS = 6;

export class MissingApiKeyError extends Error {
  constructor() {
    super("ZAI_API_KEY is not configured.");
    this.name = "MissingApiKeyError";
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json?.error?.message || json?.message || text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function runChat(opts: RunChatOptions): Promise<string> {
  if (!env.zaiApiKey) throw new MissingApiKeyError();

  const url = `${env.baseUrl}/chat/completions`;
  const convo: ChatMessage[] = [...opts.messages];
  const callbacks = opts.callbacks ?? {};

  callbacks.onStart?.({ model: env.model, effort: opts.effort });

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const body: Record<string, unknown> = {
      model: env.model,
      messages: convo,
      reasoning_effort: "max",
      max_tokens: 32768,
      temperature: 1,
      top_p: 0.95,
      thinking: { type: "enabled", clear_thinking: false },
      tool_stream: true,
      stream: true,
      tool_choice: "auto",
      tools: opts.tools.filter((t) => opts.webSearch || t.function.name !== "search_web"),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.zaiApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const detail = await readError(res);
      throw new Error(
        res.status === 401
          ? "Z.AI rejected the API key (401). Check ZAI_API_KEY."
          : `GLM-5.3-Flash API error (${res.status}): ${detail}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let reasoning = "";
    const toolCalls = new Map<number, ToolCallAccumulator>();
    let finished = false;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        finished = true;
        return;
      }
      try {
        const chunk = JSON.parse(payload);
        const delta = chunk?.choices?.[0]?.delta;
        if (typeof delta?.reasoning_content === "string") reasoning += delta.reasoning_content;
        if (typeof delta?.content === "string" && delta.content.length > 0) {
          text += delta.content;
          callbacks.onDelta?.(delta.content);
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === "number" ? tc.index : 0;
            const acc = toolCalls.get(idx) ?? { id: "", name: "", args: "" };
            if (typeof tc.id === "string") acc.id = tc.id;
            if (typeof tc.function?.name === "string") acc.name = tc.function.name;
            if (typeof tc.function?.arguments === "string") acc.args += tc.function.arguments;
            toolCalls.set(idx, acc);
          }
        }
      } catch {
        // Ignore malformed SSE lines.
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        handleLine(line);
      }
    }
    if (buffer.trim().length > 0) handleLine(buffer);
    void finished;

    const calls = [...toolCalls.values()].filter((c) => c.id && c.name);

    if (calls.length === 0) {
      // Final answer — no more tool calls.
      return text;
    }

    // Append the assistant's tool-call message, then execute each tool.
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: text.length > 0 ? text : null,
      reasoning_content: reasoning,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: c.args },
      })),
    };
    convo.push(assistantMsg);

    for (const call of calls) {
      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(call.args || "{}");
      } catch {
        parsedArgs = {};
      }
      callbacks.onToolCall?.(call.id, call.name, parsedArgs);
      try {
        if (!opts.tools.some((t) => t.function.name === call.name) || (!opts.webSearch && call.name === "search_web")) throw new Error("Tool is not enabled");
        const result = await opts.executeTool(call.name, parsedArgs);
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: result,
        });
        callbacks.onToolResult?.(call.id, call.name, true, "");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tool failed";
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: `Error: ${message}`,
        });
        callbacks.onToolResult?.(call.id, call.name, false, message);
      }
    }
    // Loop again so the model can use the tool results.
  }

  // Tool budget exhausted — return whatever text we have, or a notice.
  return "I reached the tool-call limit before finishing. Please ask again.";
}
