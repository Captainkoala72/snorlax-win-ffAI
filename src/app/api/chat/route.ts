import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessage, chatSession } from "@/db/schema";
import { MissingApiKeyError, runChat } from "@/lib/ai/client";
import { buildSystemPrompt, type ChatMessage } from "@/lib/ai/prompt";
import { executeTool, TOOL_DEFS } from "@/lib/ai/tools";
import { env, REASONING_EFFORTS, type ReasoningEffort } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ChatRequestBody {
  sessionId?: number | string;
  message?: string;
  reasoningEffort?: string;
  webSearch?: boolean;
}

const leagueKey = () => env.leagueId || "demo";

function asEffort(v: unknown): ReasoningEffort {
  if (typeof v === "string") {
    const found = REASONING_EFFORTS.find((e) => e.id === v);
    if (found) return found.id;
  }
  return "max";
}

function truncateTitle(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean || "New conversation";
}

function friendlyError(err: unknown): string {
  if (err instanceof MissingApiKeyError) {
    return "GLM-5.3-Flash is not connected yet. Add ZAI_API_KEY to your environment secrets to start chatting.";
  }
  if (err instanceof Error) {
    if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
      return "Could not reach the GLM-5.3-Flash API. Check your connection to api.z.ai.";
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let sessionId = Number(body.sessionId);
      if (!Number.isFinite(sessionId) || sessionId <= 0) sessionId = 0;

      try {
        if (!userMessage) throw new Error("Message cannot be empty.");
        const db = getDb();

        // ---- Session: create if needed, scope to the active league ----
        if (sessionId === 0) {
          const [row] = await db
            .insert(chatSession)
            .values({ title: truncateTitle(userMessage), leagueId: leagueKey() })
            .returning();
          sessionId = row.id;
        } else {
          const [existing] = await db
            .select()
            .from(chatSession)
            .where(eq(chatSession.id, sessionId));
          if (!existing) {
            const [row] = await db
              .insert(chatSession)
              .values({ title: truncateTitle(userMessage), leagueId: leagueKey() })
              .returning();
            sessionId = row.id;
          }
        }

        send("start", { sessionId, model: env.model, effort });

        // ---- History ----
        const historyRows = await db
          .select()
          .from(chatMessage)
          .where(eq(chatMessage.sessionId, sessionId))
          .orderBy(asc(chatMessage.id));

        const history: ChatMessage[] = [];
        for (const row of historyRows) {
          const d = row.data as Partial<ChatMessage> | null;
          if (
            d &&
            typeof d === "object" &&
            typeof d.role === "string" &&
            ["user", "assistant", "tool", "system"].includes(d.role) &&
            typeof d.content === "string"
          ) {
            history.push(d as ChatMessage);
          }
        }

        // ---- Persist the incoming user turn ----
        const userMsg: ChatMessage = { role: "user", content: userMessage };
        await db.insert(chatMessage).values({
          sessionId,
          role: "user",
          data: userMsg,
        });

        const systemPrompt = await buildSystemPrompt();
        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...history,
          userMsg,
        ];

        // ---- Stream the model, running the tool loop server-side ----
        const answer = await runChat({
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
          throw new Error("GLM-5.3-Flash returned an empty response. Please try again.");
        }

        const assistantMsg: ChatMessage = { role: "assistant", content: answer };
        await db.insert(chatMessage).values({
          sessionId,
          role: "assistant",
          data: assistantMsg,
        });
        await db
          .update(chatSession)
          .set({ updatedAt: new Date() })
          .where(eq(chatSession.id, sessionId));

        send("done", { ok: true });
      } catch (err) {
        send("error", { message: friendlyError(err), sessionId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
