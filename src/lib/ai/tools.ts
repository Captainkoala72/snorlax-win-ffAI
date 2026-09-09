// OpenAI-compatible function tools exposed to Muse Spark 1.3.
// Every tool is backed by live ESPN league data or public ESPN news/search.

import { findTeam, getLeagueData } from "../espn/client";
import { getNflNews, searchWeb } from "../espn/news";

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const TEAM_PARAM = {
  type: "object",
  properties: {
    team: {
      type: "string",
      description:
        "Exact fantasy team name, abbreviation, or manager name from the league.",
    },
  },
  required: ["team"],
} as const;

const WEEK_PARAM = {
  type: "object",
  properties: {
    week: {
      type: "integer",
      description: "NFL matchup week (1-16). Defaults to the current week.",
    },
  },
  required: [],
} as const;

export const TOOL_DEFS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_league_overview",
      description:
        "Get the league overview: name, season, size, scoring rules, current week, and current standings.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_teams",
      description:
        "List every fantasy team with manager, record, points for/against, streak, and waiver rank.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team",
      description:
        "Get one team's full roster (players, positions, NFL team, injury status, season points), record, streak, and current-week opponent.",
      parameters: TEAM_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "get_matchups",
      description:
        "Get all matchups for a week with scores and projections. Defaults to the current week.",
      parameters: WEEK_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "get_standings",
      description: "Get the full league standings sorted by record and points.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_player_news",
      description:
        "Get the latest NFL news headlines and injury updates from ESPN. Optionally filter with a query.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional keyword filter, e.g. a player name." },
          limit: { type: "integer", description: "Max headlines (default 15)." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the web for the latest fantasy football information: injuries, trades, depth charts, start/sit advice.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
        },
        required: ["query"],
      },
    },
  },
];

function teamById(league: Awaited<ReturnType<typeof getLeagueData>>, id: number) {
  return league.teams.find((t) => t.id === id);
}

function matchupView(league: Awaited<ReturnType<typeof getLeagueData>>, week: number) {
  return league.matchups
    .filter((m) => m.week === week)
    .map((m) => {
      const home = teamById(league, m.homeTeamId);
      const away = teamById(league, m.awayTeamId);
      return {
        home: home ? `${home.name} (${m.homePoints} pts${m.homeProjected !== null ? `, projected ${m.homeProjected}` : ""})` : `Team ${m.homeTeamId}`,
        away: away ? `${away.name} (${m.awayPoints} pts${m.awayProjected !== null ? `, projected ${m.awayProjected}` : ""})` : `Team ${m.awayTeamId}`,
        winner: m.winner === "UNDECIDED" ? "TBD" : m.winner === "HOME" ? "home" : m.winner === "AWAY" ? "away" : "tie",
      };
    });
}

export async function executeTool(name: string, args: any): Promise<string> {
  const league = await getLeagueData();

  switch (name) {
    case "get_league_overview": {
      const standings = [...league.teams]
        .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
        .map((t, i) => ({
          rank: i + 1,
          team: t.name,
          manager: t.ownerName,
          record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
          points_for: t.pointsFor,
        }));
      return JSON.stringify({
        league: league.name,
        status: league.status,
        season: league.season,
        teams: league.size,
        scoring: `${league.scoringType} (${league.pointsPerReception ?? "?"} pts/reception)`,
        current_week: league.currentWeek,
        final_week: league.finalWeek,
        standings,
      });
    }

    case "list_teams": {
      return JSON.stringify(
        league.teams.map((t) => ({
          id: t.id,
          team: t.name,
          manager: t.ownerName,
          record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
          points_for: t.pointsFor,
          points_against: t.pointsAgainst,
          streak: t.streakType ? `${t.streakType} ${t.streakLength}` : "—",
          waiver_rank: t.waiverRank,
        })),
      );
    }

    case "get_team": {
      const team = findTeam(league, args?.team ?? "");
      if (!team) {
        return JSON.stringify({
          error: `No team found matching "${args?.team ?? ""}". Use list_teams to see exact names.`,
        });
      }
      const opponent = league.matchups.find(
        (m) =>
          m.week === league.currentWeek &&
          (m.homeTeamId === team.id || m.awayTeamId === team.id),
      );
      const oppTeam = opponent
        ? teamById(league, opponent.homeTeamId === team.id ? opponent.awayTeamId : opponent.homeTeamId)
        : undefined;
      return JSON.stringify({
        team: team.name,
        manager: team.ownerName,
        record: `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`,
        points_for: team.pointsFor,
        streak: team.streakType ? `${team.streakType} ${team.streakLength}` : "—",
        waiver_rank: team.waiverRank,
        [`week_${league.currentWeek}_opponent`]: oppTeam ? oppTeam.name : "bye",
        roster: team.roster.map((p) => ({
          name: p.name,
          position: p.position,
          slot: p.slot,
          nfl_team: p.proTeamAbbr || p.proTeam,
          status: p.injuryStatus,
          season_points: p.points,
        })),
      });
    }

    case "get_matchups": {
      const week = Math.min(
        Math.max(Number(args?.week) || league.currentWeek, 1),
        league.finalWeek,
      );
      const games = matchupView(league, week);
      return JSON.stringify({
        week,
        is_playoffs: games.length > 0 && league.matchups.some((m) => m.week === week && m.isPlayoff),
        matchups: games,
      });
    }

    case "get_standings": {
      return JSON.stringify(
        [...league.teams]
          .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
          .map((t, i) => ({
            rank: i + 1,
            team: t.name,
            manager: t.ownerName,
            record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
            points_for: t.pointsFor,
            points_against: t.pointsAgainst,
            streak: t.streakType ? `${t.streakType} ${t.streakLength}` : "—",
          })),
      );
    }

    case "get_player_news": {
      const limit = Math.min(Math.max(Number(args?.limit) || 15, 1), 30);
      const news = await getNflNews(limit);
      const q = String(args?.query ?? "").toLowerCase();
      const filtered = q
        ? news.filter((n) => `${n.headline} ${n.description}`.toLowerCase().includes(q))
        : news;
      return JSON.stringify(
        (filtered.length > 0 ? filtered : news).slice(0, limit).map((n) => ({
          headline: n.headline,
          details: n.description,
          published: n.published,
          source: n.source,
        })),
      );
    }

    case "search_web": {
      const query = String(args?.query ?? "").trim();
      if (!query) return JSON.stringify({ error: "query is required" });
      const results = await searchWeb(query);
      return JSON.stringify({ query, results });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/** Short human label for a tool call, shown in the chat UI. */
export function toolSummary(name: string, args: any): string {
  switch (name) {
    case "get_league_overview":
      return "League overview";
    case "list_teams":
      return "All league teams";
    case "get_team":
      return `Team · ${args?.team ?? ""}`;
    case "get_matchups":
      return `Matchups · Week ${args?.week ?? "current"}`;
    case "get_standings":
      return "League standings";
    case "get_player_news":
      return args?.query ? `NFL news · ${args.query}` : "Latest NFL news";
    case "search_web":
      return `Web search · ${args?.query ?? ""}`;
    default:
      return name;
  }
}
