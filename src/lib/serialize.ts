import type { LeagueData } from "./espn/types";

export interface TeamSummary {
  id: number;
  name: string;
  location: string;
  nickname: string;
  abbrev: string;
  logo: string;
  color: string;
  ownerName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streakType: "WIN" | "LOSS" | "TIE" | null;
  streakLength: number;
  waiverRank: number;
}

export interface MatchupSide {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  points: number;
  projected: number | null;
}

export interface MatchupSummary {
  id: number;
  week: number;
  isPlayoff: boolean;
  home: MatchupSide;
  away: MatchupSide;
  winner: "HOME" | "AWAY" | "TIE" | "UNDECIDED";
}

export interface LeagueSummary {
  id: number;
  name: string;
  season: number;
  size: number;
  currentWeek: number;
  finalWeek: number;
  scoringType: string;
  pointsPerReception: number | null;
  status: "ok" | "demo" | "auth_error" | "not_found" | "error";
  errorMessage?: string;
}

export interface ClientLeague {
  league: LeagueSummary;
  teams: TeamSummary[];
  currentMatchups: MatchupSummary[];
}

export function serializeLeague(league: LeagueData): ClientLeague {
  return {
    league: {
      id: league.id,
      name: league.name,
      season: league.season,
      size: league.size,
      currentWeek: league.currentWeek,
      finalWeek: league.finalWeek,
      scoringType: league.scoringType,
      pointsPerReception: league.pointsPerReception,
      status: league.status,
      errorMessage: league.errorMessage,
    },
    teams: league.teams.map((t) => ({
      id: t.id,
      name: t.name,
      location: t.location,
      nickname: t.nickname,
      abbrev: t.abbrev,
      logo: t.logo,
      color: t.color,
      ownerName: t.ownerName,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      pointsFor: t.pointsFor,
      pointsAgainst: t.pointsAgainst,
      streakType: t.streakType,
      streakLength: t.streakLength,
      waiverRank: t.waiverRank,
    })),
    currentMatchups: league.matchups
      .filter((m) => m.week === league.currentWeek)
      .map((m) => {
        const home = league.teams.find((t) => t.id === m.homeTeamId);
        const away = league.teams.find((t) => t.id === m.awayTeamId);
        return {
          id: m.id,
          week: m.week,
          isPlayoff: m.isPlayoff,
          winner: m.winner,
          home: {
            id: home?.id ?? m.homeTeamId,
            name: home?.name ?? `Team ${m.homeTeamId}`,
            abbrev: home?.abbrev ?? "?",
            color: home?.color ?? "#888888",
            points: m.homePoints,
            projected: m.homeProjected,
          },
          away: {
            id: away?.id ?? m.awayTeamId,
            name: away?.name ?? `Team ${m.awayTeamId}`,
            abbrev: away?.abbrev ?? "?",
            color: away?.color ?? "#888888",
            points: m.awayPoints,
            projected: m.awayProjected,
          },
        };
      }),
  };
}
