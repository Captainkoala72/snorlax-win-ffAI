// Undocumented ESPN Fantasy Football v3 client.
// Private leagues authenticate with the SWID + espn_s2 cookies.

import { env } from "../env";
import { buildDemoLeague } from "./demo";
import { NFL_TEAMS, POSITIONS, SLOT_LABELS, SLOT_ORDER, isBenchSlot } from "./constants";
import type { LeagueData, LeagueMatchup, LeagueTeam, RosterPlayer } from "./types";

const ESPN_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";
const VIEWS = [
  "mStatus",
  "mSettings",
  "mTeam",
  "mRoster",
  "mMatchup",
  "mMatchupScore",
];

export class EspnAuthError extends Error {
  constructor() {
    super("ESPN rejected the provided SWID / espn_s2 credentials.");
    this.name = "EspnAuthError";
  }
}
export class EspnNotFoundError extends Error {
  constructor() {
    super("ESPN could not find that league for the configured season.");
    this.name = "EspnNotFoundError";
  }
}

interface CacheEntry {
  data: LeagueData;
  expires: number;
}

let cache: CacheEntry | null = null;
const OK_TTL = 5 * 60 * 1000; // 5 minutes
const ERR_TTL = 60 * 1000;

export function invalidateLeagueCache(): void {
  cache = null;
}

export async function getLeagueData(): Promise<LeagueData> {
  if (cache && cache.expires > Date.now()) return cache.data;
  const data = await loadLeagueData();
  cache = { data, expires: Date.now() + (data.status === "ok" ? OK_TTL : ERR_TTL) };
  return data;
}

async function loadLeagueData(): Promise<LeagueData> {
  if (!env.leagueId) return buildDemoLeague(env.season);
  try {
    const raw = await fetchRawLeague();
    return normalizeLeague(raw);
  } catch (err) {
    if (err instanceof EspnAuthError) {
      return errorLeague("auth_error", err.message);
    }
    if (err instanceof EspnNotFoundError) {
      return errorLeague("not_found", err.message);
    }
    return errorLeague(
      "error",
      err instanceof Error ? err.message : "Unknown error while contacting ESPN.",
    );
  }
}

function errorLeague(
  status: LeagueData["status"],
  message: string,
): LeagueData {
  return {
    id: Number(env.leagueId) || 0,
    name: "Degenerates With Integrity Fantasy Assistant",
    season: env.season,
    size: 0,
    currentWeek: 1,
    finalWeek: 16,
    scoringType: "H2H Points",
    pointsPerReception: null,
    teams: [],
    matchups: [],
    status,
    errorMessage: message,
  };
}

async function fetchRawLeague(): Promise<any> {
  if (!/^\d+$/.test(env.leagueId) || !Number.isInteger(env.season) || env.season < 2018) {
    throw new Error("Set LEAGUE_ID to a numeric ESPN league ID and SEASON_YEAR to a season from 2018 onward.");
  }
  const url = new URL(
    `${ESPN_BASE}/seasons/${env.season}/segments/0/leagues/${encodeURIComponent(env.leagueId)}`,
  );
  for (const view of VIEWS) url.searchParams.append("view", view);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.swid || env.espnS2) {
    if (!env.swid || !env.espnS2) throw new EspnAuthError();
    headers["Cookie"] =
      `SWID=${cookieValue(env.swid)}; espn_s2=${cookieValue(env.espnS2)}`;
  }

  const res = await fetch(url.toString(), {
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 401 || res.status === 403) throw new EspnAuthError();
  if (res.status >= 300 && res.status < 400) throw new EspnAuthError();
  if (res.status === 404) throw new EspnNotFoundError();
  if (!res.ok) throw new Error(`ESPN responded with HTTP ${res.status}.`);
  if (!res.headers.get("content-type")?.includes("json")) {
    throw new Error("ESPN returned a non-JSON response. Check league visibility and refresh the ESPN cookies.");
  }
  const raw = await res.json();
  if (!raw || Array.isArray(raw) || !Array.isArray(raw.teams) || raw.teams.length === 0) {
    throw new Error("ESPN returned no league teams. Check LEAGUE_ID, SEASON_YEAR and private-league access.");
  }
  return raw;
}

function cookieValue(value: string): string {
  const cookie = value.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (/[\r\n;\s]/.test(cookie)) throw new Error("Enter only the ESPN cookie value, without its name or other cookies.");
  // Preserve browser cookie percent escapes exactly; do not encode a second time.
  return cookie;
}

function round1(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.round(v * 10) / 10;
}

function normalizeLeague(raw: any): LeagueData {
  const members = new Map<string, any>(
    ((raw?.members as any[]) ?? []).map((m) => [m.id, m]),
  );

  const teams: LeagueTeam[] = ((raw?.teams as any[]) ?? [])
    .map((t) => normalizeTeam(t, members))
    .filter((t): t is LeagueTeam => t !== null);

  const matchups: LeagueMatchup[] = ((raw?.schedule as any[]) ?? [])
    .map(normalizeMatchup)
    .filter((m): m is LeagueMatchup => m !== null);

  const receptionItem = (raw?.settings?.scoringSettings?.scoringItems as any[] | undefined)
    ?.find((it) => Number(it?.statId ?? it?.id) === 53);

  return {
    id: Number(raw?.id ?? env.leagueId) || 0,
    name: (raw?.settings?.name as string) || (raw?.name as string) || "Degenerates With Integrity Fantasy Assistant",
    season: Number(raw?.seasonId ?? env.season) || env.season,
    size: Number(raw?.settings?.size ?? teams.length) || teams.length,
    currentWeek: Number(raw?.status?.currentMatchupPeriod ?? 1),
    finalWeek: Number(raw?.status?.finalMatchupPeriod ?? 16),
    scoringType:
      (raw?.settings?.scoringSettings?.scoringType as string) || "H2H Points",
    pointsPerReception:
      receptionItem && typeof receptionItem.points === "number"
        ? receptionItem.points
        : null,
    teams,
    matchups,
    status: "ok",
  };
}

function normalizeTeam(t: any, members: Map<string, any>): LeagueTeam | null {
  if (!t || typeof t.id !== "number") return null;
  const ownerId =
    (Array.isArray(t.owners) && t.owners.length ? String(t.owners[0]) : "") ||
    (t.primaryOwner ? String(t.primaryOwner) : "");
  const owner = members.get(ownerId);
  const ownerName =
    (owner?.displayName as string) ||
    [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") ||
    "Unknown manager";

  const name =
    (typeof t.name === "string" && t.name.trim()) ||
    [t.location, t.nickname].filter(Boolean).join(" ") ||
    `Team ${t.id}`;

  const roster: RosterPlayer[] = ((t?.roster?.entries as any[]) ?? [])
    .map(normalizeRosterEntry)
    .filter((p): p is RosterPlayer => p !== null)
    .sort(
      (a, b) =>
        (SLOT_ORDER[a.slotId] ?? 7) - (SLOT_ORDER[b.slotId] ?? 7) ||
        b.points - a.points,
    );

  return {
    id: t.id,
    name,
    location: (t.location as string) ?? "",
    nickname: (t.nickname as string) ?? "",
    abbrev: (t.abbrev as string) ?? "",
    logo: (t.logo as string) ?? "",
    color: (t.color as string) ?? "#a13042",
    ownerName,
    ownerId,
    wins: Number(t?.record?.overall?.wins ?? 0),
    losses: Number(t?.record?.overall?.losses ?? 0),
    ties: Number(t?.record?.overall?.ties ?? 0),
    pointsFor: round1(t?.record?.overall?.pointsFor ?? t?.points),
    pointsAgainst: round1(t?.record?.overall?.pointsAgainst ?? t?.pointsAgainst),
    streakType: t?.streak?.type === "WIN" || t?.streak?.type === "LOSS" || t?.streak?.type === "TIE"
      ? t.streak.type
      : null,
    streakLength: Number(t?.streak?.length ?? 0),
    waiverRank: Number(t?.waiverRank ?? 0),
    roster,
  };
}

function normalizeRosterEntry(e: any): RosterPlayer | null {
  const p = e?.playerPoolEntry?.player;
  if (!p || typeof p.id !== "number") return null;
  const slotId = Number(e?.lineupSlotId ?? -1);
  return {
    id: p.id,
    name:
      (p.fullName as string) ||
      [p.firstName, p.lastName].filter(Boolean).join(" ") ||
      `Player ${p.id}`,
    position: POSITIONS[Number(p.defaultPositionId)] ?? `P${p.defaultPositionId ?? "?"}`,
    slot: SLOT_LABELS[slotId] ?? `SLOT ${slotId}`,
    slotId,
    isStarter: !isBenchSlot(slotId),
    proTeam: NFL_TEAMS[Number(p.proTeamId)]?.name ?? (p.proTeam as string) ?? "Free agent",
    proTeamAbbr: NFL_TEAMS[Number(p.proTeamId)]?.abbr ?? "",
    injured: Boolean(p.injured),
    injuryStatus: (p.injuryStatus as string) || "ACTIVE",
    points: round1(e?.playerPoolEntry?.appliedStatTotal),
  };
}

function normalizeMatchup(m: any): LeagueMatchup | null {
  if (!m || typeof m.id !== "number" || typeof m.matchupPeriodId !== "number") return null;
  const homeId = Number(m?.home?.teamId ?? -1);
  const awayId = Number(m?.away?.teamId ?? -1);
  if (homeId < 0 || awayId < 0) return null;
  const winner = m?.winner;
  return {
    id: m.id,
    week: m.matchupPeriodId,
    homeTeamId: homeId,
    awayTeamId: awayId,
    homePoints: round1(m?.home?.totalPoints),
    awayPoints: round1(m?.away?.totalPoints),
    homeProjected:
      typeof m?.home?.totalProjectedPointsLive === "number"
        ? round1(m.home.totalProjectedPointsLive)
        : null,
    awayProjected:
      typeof m?.away?.totalProjectedPointsLive === "number"
        ? round1(m.away.totalProjectedPointsLive)
        : null,
    winner:
      winner === "HOME" || winner === "AWAY" || winner === "TIE"
        ? winner
        : "UNDECIDED",
    isPlayoff: Boolean(m?.playoffs),
  };
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function findTeam(league: LeagueData, query: string | number): LeagueTeam | undefined {
  if (typeof query === "number" || /^\d+$/.test(String(query).trim())) {
    const id = Number(query);
    return league.teams.find((t) => t.id === id);
  }
  const q = norm(String(query).trim());
  if (!q) return undefined;
  return (
    league.teams.find((t) => norm(t.name) === q) ||
    league.teams.find((t) => t.abbrev.toLowerCase() === q) ||
    league.teams.find((t) => norm(t.name).includes(q)) ||
    league.teams.find((t) => norm(`${t.location} ${t.nickname}`).includes(q)) ||
    league.teams.find((t) => norm(t.ownerName).includes(q))
  );
}
