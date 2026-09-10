import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessage, chatSession } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return Response.json({ error: "Invalid session id" }, { status: 400 });
  }
  const [session] = await db
    .select()
    .from(chatSession)
    .where(eq(chatSession.id, sessionId));
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  const messages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.sessionId, sessionId))
    .orderBy(asc(chatMessage.id));
  return Response.json({ session, messages });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return Response.json({ error: "Invalid session id" }, { status: 400 });
  }
  await db.delete(chatSession).where(eq(chatSession.id, sessionId));
  return Response.json({ ok: true });
}
