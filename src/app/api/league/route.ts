import { getLeagueData } from "@/lib/espn/client";
import { serializeLeague } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const league = await getLeagueData();
  return Response.json(serializeLeague(league));
}
