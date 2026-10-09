import { env } from "../env";
import type { RunChatOptions } from "./client";

// Keep entire content blocks, including signed thinking and encrypted search results,
// when continuing a tool turn. Only text and source links are sent to the browser.
type Block = { type: string; [key: string]: any };
type Message = { role: "user" | "assistant"; content: string | Block[] };
const MAX_ITERATIONS = 12;

export async function runAnthropicChat(opts: RunChatOptions): Promise<string> {
  const callbacks = opts.callbacks ?? {};
  const messages: Message[] = opts.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as Message["role"], content: m.content ?? "" }));
  const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const clientTools = opts.tools.filter((t) => t.function.name !== "search_web");
  const tools: Record<string, unknown>[] = clientTools.map(({ function: tool }) => ({
    name: tool.name, description: tool.description, input_schema: tool.parameters,
  }));
  if (opts.webSearch) tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 5 });
  callbacks.onStart?.({ model: "claude-haiku-5-5", effort: "max" });
  let answer = "";
  const sources = new Map<string, string>();
  const searchCalls = new Set<string>();
  const emit = (text: string) => { answer += text; callbacks.onDelta?.(text); };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "x-api-key": env.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5", max_tokens: 64000, system, messages,
        thinking: { type: "adaptive" }, output_config: { effort: "max" },
        tools, ...(tools.length ? { tool_choice: { type: "auto" } } : {}), stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      // Avoid reflecting upstream request details or credentials into the UI.
      throw new Error(res.status === 401
        ? "Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY."
        : `Claude Haiku 5.5 API error (HTTP ${res.status}). Check model access, billing, and web search availability in Anthropic.`);
    }
    const blocks: Block[] = [];
    const partialInputs = new Map<number, string>();
    let stopReason = "";
    let complete = false;
    const noteSources = (citations: any[]) => {
      for (const citation of citations) {
        if (typeof citation?.url === "string" && /^https?:\/\//i.test(citation.url)) {
          sources.set(citation.url, String(citation.title ?? "Source"));
        }
      }
    };
    const handleEvent = (payload: string) => {
      const event = JSON.parse(payload);
      if (event.type === "error") throw new Error(`Anthropic stream error (${event.error?.type ?? "unknown"}). Please try again.`);
      if (event.type === "content_block_start") {
        blocks[event.index] = structuredClone(event.content_block);
        const block = blocks[event.index];
        if (block.type === "text") {
          if (block.text) emit(block.text);
          noteSources(block.citations ?? []);
        }
      } else if (event.type === "content_block_delta") {
        const block = blocks[event.index];
        if (!block) throw new Error("Anthropic returned an invalid content stream.");
        const delta = event.delta;
        if (delta.type === "text_delta") { block.text += delta.text; emit(delta.text); }
        else if (delta.type === "thinking_delta") block.thinking += delta.thinking;
        else if (delta.type === "signature_delta") block.signature = (block.signature ?? "") + delta.signature;
        else if (delta.type === "input_json_delta") partialInputs.set(event.index, (partialInputs.get(event.index) ?? "") + delta.partial_json);
        else if (delta.type === "citations_delta") {
          block.citations = [...(block.citations ?? []), delta.citation];
          noteSources([delta.citation]);
        }
      } else if (event.type === "content_block_stop") {
        const block = blocks[event.index];
        if (partialInputs.has(event.index)) block.input = JSON.parse(partialInputs.get(event.index)!);
        if (block.type === "server_tool_use" && block.name === "web_search") {
          searchCalls.add(block.id);
          callbacks.onToolCall?.(block.id, "web_search", block.input);
        }
        if (block.type === "web_search_tool_result") {
          const error = !Array.isArray(block.content) ? block.content?.error_code : undefined;
          callbacks.onToolResult?.(block.tool_use_id, "web_search", !error, error ?? "");
          searchCalls.delete(block.tool_use_id);
          if (Array.isArray(block.content)) noteSources(block.content);
        }
      } else if (event.type === "message_delta") stopReason = event.delta.stop_reason;
      else if (event.type === "message_stop") complete = true;
    };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line.startsWith("data:")) handleEvent(line.slice(5).trim());
        }
        if (done) break;
      }
      if (buffer.trim().startsWith("data:")) handleEvent(buffer.trim().slice(5).trim());
    } finally { await reader.cancel(); reader.releaseLock(); }
    if (!complete) throw new Error("Anthropic's response stream ended unexpectedly. Please try again.");
    messages.push({ role: "assistant", content: blocks });
    const calls = blocks.filter((b) => b.type === "tool_use");
    if (calls.length) {
      const results: Block[] = [];
      for (const call of calls) {
        callbacks.onToolCall?.(call.id, call.name, call.input);
        try {
          if (!clientTools.some((t) => t.function.name === call.name)) throw new Error("Tool is not enabled");
          const content = await opts.executeTool(call.name, call.input);
          results.push({ type: "tool_result", tool_use_id: call.id, content });
          callbacks.onToolResult?.(call.id, call.name, true, "");
        } catch (err) {
          const content = err instanceof Error ? err.message : "Tool failed";
          results.push({ type: "tool_result", tool_use_id: call.id, content, is_error: true });
          callbacks.onToolResult?.(call.id, call.name, false, content);
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    if (stopReason === "pause_turn") continue;
    if (stopReason === "max_tokens") throw new Error("Claude Haiku 5.5 reached its response limit. Please try a more focused question.");
    if (stopReason === "refusal") throw new Error("Claude Haiku 5.5 declined this request. Please rephrase your question.");
    if (stopReason !== "end_turn") throw new Error("Claude Haiku 5.5 stopped before finishing. Please try again.");
    if (!answer.trim()) throw new Error("Claude Haiku 5.5 returned an empty response. Please try again.");
    if (sources.size) {
      const links = [...sources].map(([url, title]) => `[${title.replace(/[\[\]\\\n\r]/g, " ")}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`);
      emit(`\n\nSources: ${links.join(" · ")}`);
    }
    for (const id of searchCalls) callbacks.onToolResult?.(id, "web_search", false, "Search did not complete");
    return answer;
  }
  throw new Error("Claude Haiku 5.5 reached the tool-call limit before finishing. Please ask a more focused question.");
}
