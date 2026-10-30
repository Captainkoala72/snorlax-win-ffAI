import { env } from "../env";
import type { RunChatOptions } from "./client";
import type { OpenAIModel } from "./models";
import { reasoningEffortFor } from "./reasoning";

type ApiItem = { type: string; [key: string]: any };
const MAX_ITERATIONS = 12;
const linkUrl = (url: string) => url.replace(/[()\s<>\\]/g, (char) => encodeURIComponent(char));

/** Render Responses URL annotations as visible, clickable inline citations. */
function renderText(block: ApiItem, sources: Map<string, { title: string; number: number }>): string {
  let text = String(block.text ?? "");
  const citations: Array<{ end: number; marker: string }> = [];
  for (const citation of block.annotations ?? []) {
    if (citation.type !== "url_citation" || typeof citation.url !== "string" || !/^https?:\/\//i.test(citation.url)) continue;
    let source = sources.get(citation.url);
    if (!source) {
      source = { title: String(citation.title || "Source"), number: sources.size + 1 };
      sources.set(citation.url, source);
    }
    const end = Number.isInteger(citation.end_index) ? Math.min(Math.max(citation.end_index, 0), text.length) : text.length;
    citations.push({ end, marker: ` [${source.number}](${linkUrl(citation.url)})` });
  }
  for (const citation of citations.sort((a, b) => b.end - a.end)) text = text.slice(0, citation.end) + citation.marker + text.slice(citation.end);
  return text.replace(/\uE200cite\uE202[^\uE201]*\uE201/g, "");
}

export async function runOpenAIChat(opts: RunChatOptions & { model: OpenAIModel }): Promise<string> {
  const callbacks = opts.callbacks ?? {};
  const effort = reasoningEffortFor(opts.model, opts.effort);
  const instructions = opts.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const input: Record<string, unknown>[] = opts.messages.filter((message) => message.role === "user" || message.role === "assistant").map((message) => ({
    role: message.role,
    ...(message.role === "assistant" ? { phase: "final_answer" } : {}),
    content: message.role === "user" && message.images?.length ? [
      { type: "input_text", text: message.content || "Analyze the attached image." },
      ...message.images.map((image) => ({ type: "input_image", image_url: image.dataUrl, detail: "auto" })),
    ] : message.content ?? "",
  }));
  const clientTools = opts.tools.filter((tool) => tool.function.name !== "search_web");
  const tools: Record<string, unknown>[] = clientTools.map(({ function: tool }) => ({
    type: "function", name: tool.name, description: tool.description, parameters: tool.parameters,
    // Preserve optional week/query fields in the existing league-tool schemas.
    strict: false,
  }));
  if (opts.webSearch) tools.push({ type: "web_search", external_web_access: true });
  callbacks.onStart?.({ model: opts.model, effort });
  let answer = "";
  const sources = new Map<string, { title: string; number: number }>();

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const prefix = answer;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openaiApiKey}` },
      body: JSON.stringify({
        model: opts.model, instructions, input, reasoning: { effort },
        // Stateless responses return encrypted reasoning for tool continuations.
        store: false, stream: true, max_output_tokens: 65536,
        ...(tools.length ? { tools, tool_choice: "auto", parallel_tool_calls: true } : {}),
      }),
    });
    if (!response.ok || !response.body) throw new Error(response.status === 401
      ? "OpenAI rejected the API key (401). Check OPENAI_API_KEY."
      : `OpenAI API error (HTTP ${response.status}). Check model access, API credits and rate limits.`);

    let completed: { status: string; output: ApiItem[] } | undefined;
    const searchStates = new Map<string, boolean>();
    const noteSearch = (item: ApiItem, finished = false) => {
      if (!opts.webSearch) throw new Error("OpenAI returned web search while it was disabled.");
      if (!searchStates.has(item.id)) {
        callbacks.onToolCall?.(item.id, "web_search", { query: item.action?.query || item.action?.queries?.join("; ") || "Current web sources" });
        searchStates.set(item.id, false);
      }
      if (finished && !searchStates.get(item.id)) {
        const ok = item.status === "completed";
        callbacks.onToolResult?.(item.id, "web_search", ok, ok ? "" : "Web search did not complete.");
        searchStates.set(item.id, true);
      }
    };
    const handleLine = (line: string) => {
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      const event = JSON.parse(payload);
      if (event.type === "error" || event.type === "response.failed") throw new Error("OpenAI could not complete the response. Check API access and retry.");
      if (event.type === "response.incomplete") throw new Error(event.response?.incomplete_details?.reason === "max_output_tokens"
        ? "OpenAI reached its response limit. Please ask a more focused question."
        : "OpenAI stopped before finishing the response. Please try again.");
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        answer += event.delta;
        callbacks.onDelta?.(event.delta);
      }
      if (event.type === "response.output_item.added" && event.item?.type === "web_search_call") noteSearch(event.item);
      if (event.type === "response.output_item.done" && event.item?.type === "web_search_call") noteSearch(event.item, true);
      if (event.type === "response.completed") completed = event.response;
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
    if (!completed || completed.status !== "completed" || !Array.isArray(completed.output)) throw new Error("OpenAI's response stream ended unexpectedly. Please try again.");
    const output = completed.output;
    let rendered = "";
    for (const item of output) {
      if (item.type === "web_search_call") noteSearch(item, true);
      if (item.type === "message") {
        for (const block of item.content ?? []) {
          if (block.type === "refusal") throw new Error("OpenAI declined this request. Please rephrase your question.");
          if (block.type === "output_text") rendered += renderText(block, sources);
        }
      }
    }
    // Replace streamed text with the same answer containing the citation links.
    answer = prefix + rendered;
    callbacks.onReplace?.(answer);
    // Replay every output item, including encrypted reasoning, phase and search
    // state. None of these private continuation items are accepted from browsers.
    input.push(...output);
    const calls = output.filter((item) => item.type === "function_call");
    if (calls.length) {
      for (const call of calls) {
        if (!call.call_id || !call.name) throw new Error("OpenAI returned an incomplete tool call. Please try again.");
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments?.trim() || "{}");
          if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Invalid tool arguments");
          callbacks.onToolCall?.(call.call_id, call.name, args);
          if (!clientTools.some((tool) => tool.function.name === call.name)) throw new Error("Tool is not enabled");
          const result = await opts.executeTool(call.name, args);
          input.push({ type: "function_call_output", call_id: call.call_id, output: result });
          callbacks.onToolResult?.(call.call_id, call.name, true, "");
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Tool failed";
          input.push({ type: "function_call_output", call_id: call.call_id, output: `Error: ${detail}` });
          callbacks.onToolResult?.(call.call_id, call.name, false, detail);
        }
      }
      continue;
    }
    if (!rendered.trim()) throw new Error("OpenAI returned an empty answer. Please try again.");
    if (output.some((item) => item.type === "message" && item.phase === "commentary") &&
      !output.some((item) => item.type === "message" && item.phase === "final_answer")) {
      throw new Error("OpenAI stopped before giving a final answer. Please try again.");
    }
    if (sources.size) {
      const links = [...sources].map(([url, source]) => `[${source.title.replace(/[\[\]\\\r\n]/g, " ")}](${linkUrl(url)})`);
      const suffix = `\n\nSources: ${links.join(" · ")}`;
      answer += suffix;
      callbacks.onDelta?.(suffix);
    }
    return answer;
  }
  throw new Error("OpenAI reached the tool-call limit before finishing. Please ask a more focused question.");
}
