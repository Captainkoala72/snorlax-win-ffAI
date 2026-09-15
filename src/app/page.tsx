import { FantasyAssistantApp } from "@/components/FantasyAssistantApp";
import { getLeagueData } from "@/lib/espn/client";
import { serializeLeague } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function Page() {
  const league = await getLeagueData();
  return <FantasyAssistantApp initial={serializeLeague(league)} />;
}
