import { getLeagueData, invalidateLeagueCache } from "@/lib/espn/client";
import { serializeLeague } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("refresh") === "1") invalidateLeagueCache();
  const league = await getLeagueData();
  return Response.json(serializeLeague(league));
}
