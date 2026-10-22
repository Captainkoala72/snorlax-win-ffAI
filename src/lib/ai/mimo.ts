import { env } from "../env";
import type { RunChatOptions } from "./client";

interface ToolCall { id: string; name: string; args: string }
const MAX_ITERATIONS = 12;

export async function runMimoChat(opts: RunChatOptions): Promise<string> {
  const callbacks = opts.callbacks ?? {};
  const messages: Record<string, unknown>[] = opts.messages.map(({ images, ...message }) => ({
    ...message,
    ...(images?.length && message.role === "user" ? {
      content: [
        { type: "text", text: message.content || "Analyze the attached image." },
        ...images.map((image) => ({ type: "image_url", image_url: { url: image.dataUrl } })),
      ],
    } : {}),
  }));
  // MiMo executes its own native web search; league/news tools execute here.
  const clientTools = opts.tools.filter((tool) => tool.function.name !== "search_web");
  const tools: unknown[] = [...clientTools];
  if (opts.webSearch) tools.push({ type: "web_search", max_keyword: 3, force_search: false });
  callbacks.onStart?.({ model: "mimo-v2.6-pro", effort: "enabled" });
  const sources = new Map<string, string>();
  let answer = "";
  const emit = (text: string) => { answer += text; callbacks.onDelta?.(text); };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": env.mimoApiKey },
      body: JSON.stringify({
        model: "mimo-v2.6-pro", messages, thinking: { type: "enabled" },
        max_completion_tokens: 65536, stream: true,
        ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      }),
    });
    if (!response.ok || !response.body) {
      throw new Error(response.status === 401
        ? "Xiaomi MiMo rejected the API key (401). Check MIMO_API_KEY."
        : `MiMo V2.6 Pro API error (HTTP ${response.status}). Check your MiMo key, model access, balance, and Web Search Plugin.`);
    }
    let text = "", reasoning = "", finishReason = "";
    const calls = new Map<number, ToolCall>();
    const searchId = `mimo-search-${iteration}`;
    let searched = false;
    const noteSearch = () => {
      if (!opts.webSearch) throw new Error("MiMo returned web search while it was disabled.");
      if (!searched) callbacks.onToolCall?.(searchId, "web_search", { query: "Current web sources" });
      searched = true;
    };
    const handleLine = (line: string) => {
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      const chunk = JSON.parse(payload);
      if (chunk.error) throw new Error("MiMo reported a streaming API error. Please try again.");
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;
      if (typeof delta?.error_message === "string" && delta.error_message) {
        noteSearch();
        callbacks.onToolResult?.(searchId, "web_search", false, "Check the MiMo Web Search Plugin.");
        throw new Error("MiMo web search failed. Check that the Web Search Plugin is activated and your account has available balance.");
      }
      if (Array.isArray(delta?.annotations) && delta.annotations.length) {
        noteSearch();
        for (const source of delta.annotations) {
          if (typeof source.url === "string" && /^https?:\/\//i.test(source.url)) sources.set(source.url, String(source.title || source.site_name || "Source"));
        }
      }
      if (chunk.usage?.web_search_usage?.tool_usage > 0) noteSearch();
      if (typeof delta?.reasoning_content === "string") reasoning += delta.reasoning_content;
      if (typeof delta?.content === "string") { text += delta.content; emit(delta.content); }
      for (const call of delta?.tool_calls ?? []) {
        const index = call.index ?? 0;
        const current = calls.get(index) ?? { id: "", name: "", args: "" };
        if (call.id) current.id = call.id;
        if (call.function?.name) current.name = call.function.name;
        if (typeof call.function?.arguments === "string") current.args += call.function.arguments;
        calls.set(index, current);
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
    };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const chunk = await reader.read();
        buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          handleLine(line);
        }
        if (chunk.done) break;
      }
      if (buffer.trim()) handleLine(buffer.trim());
    } finally { await reader.cancel(); reader.releaseLock(); }
    if (searched) callbacks.onToolResult?.(searchId, "web_search", true, "");
    if (finishReason === "length") throw new Error("MiMo reached its response limit. Please ask a more focused question.");
    if (finishReason === "content_filter") throw new Error("MiMo declined this request. Please rephrase your question.");
    if (finishReason !== "stop" && finishReason !== "tool_calls") throw new Error("MiMo's response ended before finishing. Please try again.");
    const toolCalls = [...calls.values()];
    if (toolCalls.some((call) => !call.id || !call.name)) throw new Error("MiMo returned an incomplete tool call. Please try again.");
    if (toolCalls.length) {
      // Required by MiMo's thinking-mode protocol on every tool continuation.
      messages.push({ role: "assistant", content: text || null, reasoning_content: reasoning,
        tool_calls: toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.args || "{}" } })),
      });
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.args.trim() || "{}");
          if (!args || Array.isArray(args) || typeof args !== "object") throw new Error("Invalid tool arguments");
          if (!clientTools.some((tool) => tool.function.name === call.name)) throw new Error("Tool is not enabled");
          callbacks.onToolCall?.(call.id, call.name, args);
          const result = await opts.executeTool(call.name, args);
          messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result });
          callbacks.onToolResult?.(call.id, call.name, true, "");
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Tool failed";
          messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: `Error: ${detail}` });
          callbacks.onToolResult?.(call.id, call.name, false, detail);
        }
      }
      continue;
    }
    if (finishReason === "tool_calls") throw new Error("MiMo returned no executable tool calls. Please try again.");
    if (!answer.trim()) throw new Error("MiMo returned an empty response. Please try again.");
    if (sources.size) {
      const links = [...sources].slice(0, 8).map(([url, title]) => `[${title.replace(/[\[\]\\\r\n]/g, " ")}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`);
      emit(`\n\nSources: ${links.join(" · ")}`);
    }
    return answer;
  }
  throw new Error("MiMo reached the tool-call limit before finishing. Please ask a more focused question.");
}
