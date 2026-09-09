import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatSession } from "@/db/schema";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const leagueKey = () => env.leagueId || "demo";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(chatSession)
      .where(eq(chatSession.leagueId, leagueKey()))
      .orderBy(desc(chatSession.updatedAt))
      .limit(40);
    return Response.json({ sessions: rows });
  } catch (err) {
    return Response.json(
      { sessions: [], error: err instanceof Error ? err.message : "db error" },
      { status: 200 },
    );
  }
}

export async function POST(req: Request) {
  let title = "New conversation";
  try {
    const body = await req.json();
    if (typeof body?.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 60);
    }
  } catch {
    // empty body is fine
  }
  const [row] = await db
    .insert(chatSession)
    .values({ title, leagueId: leagueKey() })
    .returning();
  return Response.json({ session: row });
}
