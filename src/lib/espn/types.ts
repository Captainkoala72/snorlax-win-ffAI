// Normalized domain objects returned by the ESPN client.

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  slot: string;
  slotId: number;
  isStarter: boolean;
  proTeam: string;
  proTeamAbbr: string;
  injured: boolean;
  injuryStatus: string;
  points: number;
}

export interface LeagueTeam {
  id: number;
  name: string;
  location: string;
  nickname: string;
  abbrev: string;
  logo: string;
  color: string;
  ownerName: string;
  ownerId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streakType: "WIN" | "LOSS" | "TIE" | null;
  streakLength: number;
  waiverRank: number;
  roster: RosterPlayer[];
}

export interface LeagueMatchup {
  id: number;
  week: number;
  homeTeamId: number;
  awayTeamId: number;
  homePoints: number;
  awayPoints: number;
  homeProjected: number | null;
  awayProjected: number | null;
  winner: "HOME" | "AWAY" | "TIE" | "UNDECIDED";
  isPlayoff: boolean;
}

export type LeagueStatus = "ok" | "demo" | "auth_error" | "not_found" | "error";

export interface LeagueData {
  id: number;
  name: string;
  season: number;
  size: number;
  currentWeek: number;
  finalWeek: number;
  scoringType: string;
  pointsPerReception: number | null;
  teams: LeagueTeam[];
  matchups: LeagueMatchup[];
  status: LeagueStatus;
  errorMessage?: string;
}

export interface LeagueMatchupView {
  id: number;
  week: number;
  home: { teamId: number; name: string; abbrev: string; color: string; points: number; projected: number | null };
  away: { teamId: number; name: string; abbrev: string; color: string; points: number; projected: number | null };
  winner: "HOME" | "AWAY" | "TIE" | "UNDECIDED";
  isPlayoff: boolean;
}
