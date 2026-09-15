// Deterministic demo league used when LEAGUE_ID is not configured.
// It mirrors the shape of a real 2026 ESPN league so the full UI stays
// explorable before the user wires up their credentials.

import { NFL_TEAMS, SLOT_LABELS, SLOT_ORDER, isBenchSlot } from "./constants";
import type { LeagueData, LeagueMatchup, LeagueTeam, RosterPlayer } from "./types";

// Deterministic PRNG so every render/build produces identical data.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_TEAMS: Array<{
  name: string;
  location: string;
  nickname: string;
  abbrev: string;
  color: string;
  owner: string;
}> = [
  { name: "Château Touchdown", location: "Château", nickname: "Touchdown", abbrev: "CHT", color: "#8e2f3f", owner: "Aldo Marchetti" },
  { name: "Crimson Corks", location: "Crimson", nickname: "Corks", abbrev: "CRC", color: "#b0404e", owner: "Bea Whitfield" },
  { name: "Vinny's Vintners", location: "Vinny's", nickname: "Vintners", abbrev: "VNT", color: "#7a3b8f", owner: "Vince Castellano" },
  { name: "Merlot Marauders", location: "Merlot", nickname: "Marauders", abbrev: "MER", color: "#a13042", owner: "Rex Okafor" },
  { name: "Pinot Pioneers", location: "Pinot", nickname: "Pioneers", abbrev: "PNT", color: "#5d4a8f", owner: "Sven Lindqvist" },
  { name: "Cabernet Commanders", location: "Cabernet", nickname: "Commanders", abbrev: "CAB", color: "#4c2f5e", owner: "Dara Osei" },
  { name: "Zinfandel Zone", location: "Zinfandel", nickname: "Zone", abbrev: "ZIN", color: "#c75d3a", owner: "Tessa Nakamura" },
  { name: "Malbec Maulers", location: "Malbec", nickname: "Maulers", abbrev: "MAL", color: "#8f3a56", owner: "Joaquin Ferreira" },
  { name: "Rosé Raiders", location: "Rosé", nickname: "Raiders", abbrev: "ROS", color: "#d4778f", owner: "Elodie Fontaine" },
  { name: "Barolo Bombers", location: "Barolo", nickname: "Bombers", abbrev: "BAR", color: "#9e2f2f", owner: "Luca Moretti" },
  { name: "Sangiovese Storm", location: "Sangiovese", nickname: "Storm", abbrev: "SAN", color: "#b03a48", owner: "Chiara Rossi" },
  { name: "Portside Packers", location: "Portside", nickname: "Packers", abbrev: "PRT", color: "#6e3a8f", owner: "Harry Ashworth" },
];

// [name, proTeamAbbr, position]
const QB_POOL: Array<[string, string]> = [
  ["Patrick Mahomes", "KC"], ["Josh Allen", "BUF"], ["Lamar Jackson", "BAL"], ["Jalen Hurts", "PHI"],
  ["C.J. Stroud", "HOU"], ["Joe Burrow", "CIN"], ["Jayden Daniels", "WAS"], ["Drake Maye", "NE"],
  ["Bo Nix", "DEN"], ["Jordan Love", "GB"], ["Dak Prescott", "DAL"], ["Tua Tagovailoa", "MIA"],
  ["Cam Ward", "TEN"], ["Brock Purdy", "SF"],
];
const RB_POOL: Array<[string, string]> = [
  ["Saquon Barkley", "PHI"], ["Bijan Robinson", "ATL"], ["Breece Hall", "NYJ"], ["Jahmyr Gibbs", "DET"],
  ["Jonathan Taylor", "IND"], ["Travis Etienne", "JAX"], ["Kenneth Walker III", "SEA"], ["Kyren Williams", "LAR"],
  ["Josh Jacobs", "GB"], ["James Cook", "BUF"], ["Aaron Jones", "MIN"], ["D'Andre Swift", "CHI"],
  ["Chuba Hubbard", "CAR"], ["Najee Harris", "LAC"], ["Joe Mixon", "HOU"], ["Javonte Williams", "DEN"],
  ["Isiah Pacheco", "KC"], ["Rachaad White", "TB"], ["Brian Robinson Jr.", "WAS"], ["Ray Davis", "BUF"],
  ["Trey Benson", "ARI"], ["Jonathon Brooks", "CAR"], ["Will Shipley", "PHI"], ["Blake Corum", "LAR"],
  ["De'Von Achane", "MIA"], ["Jaylen Wright", "MIA"], ["Audric Estimé", "DEN"], ["Tyrone Tracy Jr.", "NYG"],
  ["Bucky Irving", "TB"], ["Kaleb Johnson", "PIT"], ["Ollie Gordon II", "DET"], ["TreVeyon Henderson", "NE"],
];
const WR_POOL: Array<[string, string]> = [
  ["Justin Jefferson", "MIN"], ["Ja'Marr Chase", "CIN"], ["CeeDee Lamb", "DAL"], ["Tyreek Hill", "MIA"],
  ["A.J. Brown", "PHI"], ["Amon-Ra St. Brown", "DET"], ["Malik Nabers", "NYG"], ["Rome Odunze", "CHI"],
  ["Garrett Wilson", "NYJ"], ["Drake London", "ATL"], ["Chris Olave", "NO"], ["Brandon Aiyuk", "SF"],
  ["Tee Higgins", "CIN"], ["Jaylen Waddle", "MIA"], ["Puka Nacua", "LAR"], ["Nico Collins", "HOU"],
  ["Tank Dell", "HOU"], ["Keon Coleman", "BUF"], ["Ladd McConkey", "LAC"], ["Xavier Worthy", "KC"],
  ["Rashee Rice", "KC"], ["Jaxon Smith-Njigba", "SEA"], ["Zay Flowers", "BAL"], ["Christian Kirk", "JAX"],
  ["DeVonta Smith", "PHI"], ["Michael Pittman Jr.", "IND"], ["Marvin Harrison Jr.", "ARI"], ["Xavier Legette", "CAR"],
  ["Adonai Mitchell", "IND"], ["Brian Thomas Jr.", "JAX"], ["Terry McLaurin", "WAS"], ["Diontae Johnson", "BAL"],
  ["Courtland Sutton", "DEN"], ["Tyler Lockett", "SEA"], ["Jakobi Meyers", "LV"], ["Quentin Johnston", "LAC"],
  ["Keenan Allen", "CHI"], ["Mike Evans", "TB"], ["Darnell Mooney", "ATL"], ["Rashid Shaheed", "NO"],
  ["Elijah Moore", "CLE"], ["Cedric Tillman", "CLE"], ["Xavier Gipson", "HOU"], ["Jalin Hyatt", "NYG"],
];
const TE_POOL: Array<[string, string]> = [
  ["Sam LaPorta", "DET"], ["Travis Kelce", "KC"], ["Mark Andrews", "BAL"], ["T.J. Hockenson", "MIN"],
  ["George Kittle", "SF"], ["Brock Bowers", "LV"], ["Dallas Goedert", "PHI"], ["Evan Engram", "JAX"],
  ["Trey McBride", "ARI"], ["Cole Kmet", "CHI"], ["Jonnu Smith", "MIA"], ["Tyler Conklin", "NYJ"],
  ["Kyle Pitts", "ATL"], ["Pat Freiermuth", "PIT"], ["Chigoziem Okonkwo", "TEN"], ["Tucker Kraft", "GB"],
  ["Cade Stover", "HOU"], ["Dalton Schultz", "HOU"],
];
const K_POOL: Array<[string, string]> = [
  ["Harrison Butker", "KC"], ["Tyler Bass", "BUF"], ["Brandon Aubrey", "DAL"], ["Jake Elliott", "PHI"],
  ["Matt Gay", "IND"], ["Chris Boswell", "PIT"], ["Jason Sanders", "MIA"], ["Chase McLaughlin", "TB"],
  ["Eddy Piñeiro", "CAR"], ["Anders Carlson", "LV"], ["Cade York", "WAS"], ["Wil Lutz", "DEN"],
  ["Greg Joseph", "GB"], ["Graham Gano", "NYG"], ["Dustin Hopkins", "CLE"], ["Riley Patterson", "DET"],
];
const DST_POOL: Array<[string, string]> = [
  ["Chiefs D/ST", "KC"], ["Eagles D/ST", "PHI"], ["Ravens D/ST", "BAL"], ["Lions D/ST", "DET"],
  ["Browns D/ST", "CLE"], ["Steelers D/ST", "PIT"], ["Texans D/ST", "HOU"], ["49ers D/ST", "SF"],
  ["Cowboys D/ST", "DAL"], ["Bills D/ST", "BUF"], ["Packers D/ST", "GB"], ["Buccaneers D/ST", "TB"],
  ["Broncos D/ST", "DEN"], ["Seahawks D/ST", "SEA"], ["Rams D/ST", "LAR"], ["Dolphins D/ST", "MIA"],
];

const abbrToPro = (abbr: string): number =>
  Number(Object.entries(NFL_TEAMS).find(([, t]) => t.abbr === abbr)?.[0] ?? 0);

function shuffled<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function estimateCurrentWeek(now = new Date()): number {
  // NFL 2026 regular season opens Thursday September 10, 2026.
  const seasonStart = Date.UTC(2026, 8, 10);
  if (now.getTime() < seasonStart) return 1;
  const weeks = Math.floor((now.getTime() - seasonStart) / (7 * 24 * 3600 * 1000)) + 1;
  return Math.min(Math.max(weeks, 1), 16);
}

export function buildDemoLeague(season = 2026, now = new Date()): LeagueData {
  const rng = mulberry32(0x771e1ea9 ^ season);
  const currentWeek = estimateCurrentWeek(now);
  const finalWeek = 16;

  // ---- Round-robin pairings (circle method), 12 teams -> 11 rounds ----
  const ids = DEMO_TEAMS.map((_, i) => i);
  const rounds: Array<Array<[number, number]>> = [];
  const circle = [...ids];
  for (let r = 0; r < 11; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < 6; i++) {
      const a = circle[i];
      const b = circle[11 - i];
      // alternate home/away by round for fairness
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    circle.splice(1, 0, circle.pop() as number);
  }
  // Weeks 12-14 reuse early rounds with flipped home field.
  const weeks12to14 = [rounds[0], rounds[1], rounds[2]].map((pairs) =>
    pairs.map(([a, b]) => [b, a] as [number, number]),
  );
  const allRounds = [...rounds, ...weeks12to14];

  const teamStats = DEMO_TEAMS.map(() => ({
    wins: 0, losses: 0, ties: 0, pf: 0, pa: 0,
    lastResults: [] as Array<"W" | "L" | "T">,
    scores: [] as number[],
  }));

  const matchups: LeagueMatchup[] = [];
  let matchupId = 1;
  for (let w = 1; w <= 14; w++) {
    const pairs = allRounds[w - 1];
    for (const [home, away] of pairs) {
      const hp = Math.round((105 + (rng() - 0.5) * 44) * 10) / 10;
      const ap = Math.round((105 + (rng() - 0.5) * 44) * 10) / 10;
      const played = w < currentWeek;
      const live = w === currentWeek;
      const homePts = played || live ? hp : 0;
      const awayPts = played || live ? ap : 0;
      teamStats[home].pf += homePts; teamStats[home].pa += awayPts;
      teamStats[away].pf += awayPts; teamStats[away].pa += homePts;
      if (played) {
        if (hp > ap) { teamStats[home].wins++; teamStats[away].losses++; teamStats[home].lastResults.push("W"); teamStats[away].lastResults.push("L"); }
        else if (ap > hp) { teamStats[away].wins++; teamStats[home].losses++; teamStats[away].lastResults.push("W"); teamStats[home].lastResults.push("L"); }
        else { teamStats[home].ties++; teamStats[away].ties++; teamStats[home].lastResults.push("T"); teamStats[away].lastResults.push("T"); }
      }
      matchups.push({
        id: matchupId++, week: w,
        homeTeamId: home, awayTeamId: away,
        homePoints: homePts, awayPoints: awayPts,
        homeProjected: live ? Math.round((hp + 110) / 2) : null,
        awayProjected: live ? Math.round((ap + 104) / 2) : null,
        winner: !played ? "UNDECIDED" : hp > ap ? "HOME" : ap > hp ? "AWAY" : "TIE",
        isPlayoff: false,
      });
    }
  }

  // ---- Playoffs: top 4 after week 14, semis W15, championship W16 ----
  const ranked = teamStats
    .map((s, i) => ({ i, ...s }))
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);
  const seeds = ranked.slice(0, 4).map((r) => r.i);
  const semiPairs: Array<[number, number]> = [
    [seeds[0], seeds[3]], [seeds[1], seeds[2]],
  ];
  for (const [a, b] of semiPairs) {
    const ap = Math.round((108 + (rng() - 0.5) * 40) * 10) / 10;
    const bp = Math.round((108 + (rng() - 0.5) * 40) * 10) / 10;
    matchups.push({
      id: matchupId++, week: 15, homeTeamId: a, awayTeamId: b,
      homePoints: currentWeek > 15 ? ap : 0, awayPoints: currentWeek > 15 ? bp : 0,
      homeProjected: null, awayProjected: null,
      winner: currentWeek > 15 ? (ap > bp ? "HOME" : bp > ap ? "AWAY" : "TIE") : "UNDECIDED",
      isPlayoff: true,
    });
  }
  const semiA = matchups[matchups.length - 2];
  const semiB = matchups[matchups.length - 1];
  if (currentWeek > 15) {
    const champ = (m: LeagueMatchup) => (m.winner === "HOME" ? m.homeTeamId : m.awayTeamId);
    const champA = champ(semiA); const champB = champ(semiB);
    const thirdA = champA === semiA.homeTeamId ? semiA.awayTeamId : semiA.homeTeamId;
    const thirdB = champB === semiB.homeTeamId ? semiB.awayTeamId : semiB.homeTeamId;
    for (const [a, b] of [[champA, champB], [thirdA, thirdB]] as Array<[number, number]>) {
      const ap = Math.round((110 + (rng() - 0.5) * 38) * 10) / 10;
      const bp = Math.round((110 + (rng() - 0.5) * 38) * 10) / 10;
      matchups.push({
        id: matchupId++, week: 16, homeTeamId: a, awayTeamId: b,
        homePoints: ap, awayPoints: bp,
        homeProjected: null, awayProjected: null,
        winner: ap > bp ? "HOME" : bp > ap ? "AWAY" : "TIE",
        isPlayoff: true,
      });
    }
  }

  // ---- Rosters ----
  const qbs = shuffled(rng, QB_POOL);
  const rbs = shuffled(rng, RB_POOL);
  const wrs = shuffled(rng, WR_POOL);
  const tes = shuffled(rng, TE_POOL);
  const ks = shuffled(rng, K_POOL);
  const dsts = shuffled(rng, DST_POOL);

  const buildPlayer = (
    id: number,
    entry: [string, string],
    position: string,
    slotId: number,
    base: number,
  ): RosterPlayer => ({
    id,
    name: entry[0],
    position,
    slot: SLOT_LABELS[slotId] ?? "BN",
    slotId,
    isStarter: !isBenchSlot(slotId),
    proTeam: NFL_TEAMS[abbrToPro(entry[1])]?.name ?? entry[1],
    proTeamAbbr: entry[1],
    injured: rng() < 0.06,
    injuryStatus: rng() < 0.03 ? "Q" : rng() < 0.03 ? "O" : "ACTIVE",
    points: Math.round(base * 10) / 10,
  });

  let pid = 5000001;
  const teams: LeagueTeam[] = DEMO_TEAMS.map((t, i) => {
    const s = teamStats[i];
    const flexWr = wrs[i * 2 + 2] ?? wrs[i * 2];
    const benchRb = rbs[i + 24] ?? rbs[i];
    const benchWr = wrs[i + 24] ?? wrs[i * 2];
    const roster: RosterPlayer[] = [
      buildPlayer(pid++, [qbs[i][0], qbs[i][1]], "QB", 0, 180 + rng() * 120),
      buildPlayer(pid++, [rbs[i * 2][0], rbs[i * 2][1]], "RB", 2, 120 + rng() * 160),
      buildPlayer(pid++, [rbs[i * 2 + 1][0], rbs[i * 2 + 1][1]], "RB", 2, 80 + rng() * 120),
      buildPlayer(pid++, [wrs[i * 2][0], wrs[i * 2][1]], "WR", 4, 120 + rng() * 150),
      buildPlayer(pid++, [wrs[i * 2 + 1][0], wrs[i * 2 + 1][1]], "WR", 4, 80 + rng() * 120),
      buildPlayer(pid++, [tes[i][0], tes[i][1]], "TE", 6, 60 + rng() * 110),
      buildPlayer(pid++, [flexWr[0], flexWr[1]], "WR", 23, 70 + rng() * 90),
      buildPlayer(pid++, [dsts[i][0], dsts[i][1]], "D/ST", 16, 70 + rng() * 60),
      buildPlayer(pid++, [ks[i][0], ks[i][1]], "K", 17, 90 + rng() * 50),
      buildPlayer(pid++, [benchRb[0], benchRb[1]], "RB", 20, 40 + rng() * 80),
      buildPlayer(pid++, [benchWr[0], benchWr[1]], "WR", 20, 40 + rng() * 80),
    ];
    roster.sort((a, b) => (SLOT_ORDER[a.slotId] ?? 7) - (SLOT_ORDER[b.slotId] ?? 7) || b.points - a.points);
    const streak = s.lastResults.slice(-3);
    const streakType = streak.length && streak.every((r) => r === streak[0])
      ? (streak[0] === "W" ? "WIN" : streak[0] === "L" ? "LOSS" : "TIE")
      : null;
    return {
      id: i,
      name: t.name,
      location: t.location,
      nickname: t.nickname,
      abbrev: t.abbrev,
      logo: "",
      color: t.color,
      ownerName: t.owner,
      ownerId: `demo-${i}`,
      wins: s.wins, losses: s.losses, ties: s.ties,
      pointsFor: Math.round(s.pf * 10) / 10,
      pointsAgainst: Math.round(s.pa * 10) / 10,
      streakType,
      streakLength: streakType ? streak.length : 0,
      waiverRank: 1 + ((i * 5 + currentWeek) % 12),
      roster,
    };
  });

  return {
    id: -1,
    name: "Degenerates With Integrity Fantasy Assistant",
    season,
    size: 12,
    currentWeek,
    finalWeek,
    scoringType: "H2H Points",
    pointsPerReception: 1,
    teams,
    matchups,
    status: "demo",
    errorMessage:
      "Sample league — set LEAGUE_ID, ESPN_SWID and ESPN_S2 to connect your real ESPN league.",
  };
}
