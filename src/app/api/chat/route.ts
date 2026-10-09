import { MissingApiKeyError, runChat } from "@/lib/ai/client";
import { buildSystemPrompt, type ChatMessage } from "@/lib/ai/prompt";
import { executeTool, TOOL_DEFS } from "@/lib/ai/tools";
import { sanitizeHistory } from "@/lib/chat-history";
import { REASONING_EFFORTS, type ReasoningEffort } from "@/lib/env";
import { DEFAULT_MODEL, isChatModel } from "@/lib/ai/models";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ChatRequestBody {
  model?: unknown;
  history?: unknown;
  message?: string;
  reasoningEffort?: string;
  webSearch?: boolean;
}

function asEffort(v: unknown): ReasoningEffort {
  if (typeof v === "string") {
    const found = REASONING_EFFORTS.find((e) => e.id === v);
    if (found) return found.id;
  }
  return "max";
}

function friendlyError(err: unknown): string {
  if (err instanceof MissingApiKeyError) {
    return `The selected model is not connected yet. Add ${err.keyName} to your environment secrets to start chatting.`;
  }
  if (err instanceof Error) {
    if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
      return "Could not reach the selected model's API. Please try again.";
    }
    return err.message;
  }
  return "Something went wrong while generating a response.";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ChatRequestBody;
  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  const effort = asEffort(body.reasoningEffort);
  const webSearch = body.webSearch !== false;
  const model = body.model === undefined ? DEFAULT_MODEL : body.model;
  if (!isChatModel(model)) return Response.json({ error: "Unsupported chat model." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        if (!userMessage) throw new Error("Message cannot be empty.");
        send("start", { model, effort });
        const history = sanitizeHistory(body.history);
        const userMsg: ChatMessage = { role: "user", content: userMessage };
        const systemPrompt = await buildSystemPrompt();
        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...history,
          userMsg,
        ];

        // ---- Stream the model, running the tool loop server-side ----
        const answer = await runChat({
          model,
          messages,
          effort,
          webSearch,
          tools: TOOL_DEFS,
          executeTool,
          callbacks: {
            onDelta: (delta) => send("delta", { delta }),
            onToolCall: (id, name, args) =>
              send("tool", { id, name, args, summary: "" }),
            onToolResult: (id, name, ok, summary) =>
              send("tool-result", { id, name, ok, summary }),
          },
        });

        if (!answer || !answer.trim()) {
          throw new Error("The selected model returned an empty response. Please try again.");
        }

        send("done", { ok: true });
      } catch (err) {
        send("error", { message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
