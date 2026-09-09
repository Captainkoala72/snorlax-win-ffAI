import { findTeam, getLeagueData } from "@/lib/espn/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "";
  const league = await getLeagueData();
  const team = findTeam(league, name);
  if (!team) {
    return Response.json({ error: `No team found matching "${name}"` }, { status: 404 });
  }
  const matchup = league.matchups.find(
    (m) =>
      m.week === league.currentWeek &&
      (m.homeTeamId === team.id || m.awayTeamId === team.id),
  );
  const opp = matchup
    ? league.teams.find(
        (t) => t.id === (matchup.homeTeamId === team.id ? matchup.awayTeamId : matchup.homeTeamId),
      )
    : undefined;
  return Response.json({
    team,
    currentWeek: league.currentWeek,
    opponent: opp ? { id: opp.id, name: opp.name, color: opp.color } : null,
  });
}
