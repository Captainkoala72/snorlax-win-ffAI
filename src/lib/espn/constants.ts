// ESPN identifier maps used across the league + player normalization.

export const NFL_TEAMS: Record<number, { name: string; abbr: string }> = {
  1: { name: "Atlanta Falcons", abbr: "ATL" },
  2: { name: "Buffalo Bills", abbr: "BUF" },
  3: { name: "Chicago Bears", abbr: "CHI" },
  4: { name: "Cincinnati Bengals", abbr: "CIN" },
  5: { name: "Cleveland Browns", abbr: "CLE" },
  6: { name: "Dallas Cowboys", abbr: "DAL" },
  7: { name: "Denver Broncos", abbr: "DEN" },
  8: { name: "Detroit Lions", abbr: "DET" },
  9: { name: "Green Bay Packers", abbr: "GB" },
  10: { name: "Tennessee Titans", abbr: "TEN" },
  11: { name: "Indianapolis Colts", abbr: "IND" },
  12: { name: "Kansas City Chiefs", abbr: "KC" },
  13: { name: "Las Vegas Raiders", abbr: "LV" },
  14: { name: "Los Angeles Rams", abbr: "LAR" },
  15: { name: "Miami Dolphins", abbr: "MIA" },
  16: { name: "Minnesota Vikings", abbr: "MIN" },
  17: { name: "New England Patriots", abbr: "NE" },
  18: { name: "New Orleans Saints", abbr: "NO" },
  19: { name: "New York Giants", abbr: "NYG" },
  20: { name: "New York Jets", abbr: "NYJ" },
  21: { name: "Philadelphia Eagles", abbr: "PHI" },
  22: { name: "Arizona Cardinals", abbr: "ARI" },
  23: { name: "Pittsburgh Steelers", abbr: "PIT" },
  24: { name: "Los Angeles Chargers", abbr: "LAC" },
  25: { name: "San Francisco 49ers", abbr: "SF" },
  26: { name: "Seattle Seahawks", abbr: "SEA" },
  27: { name: "Tampa Bay Buccaneers", abbr: "TB" },
  28: { name: "Washington Commanders", abbr: "WAS" },
  29: { name: "Carolina Panthers", abbr: "CAR" },
  30: { name: "Jacksonville Jaguars", abbr: "JAX" },
  33: { name: "Baltimore Ravens", abbr: "BAL" },
  34: { name: "Houston Texans", abbr: "HOU" },
};

/** defaultPositionId on player objects. */
export const POSITIONS: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "D/ST",
};

/** lineupSlotId on roster entries. */
export const SLOT_LABELS: Record<number, string> = {
  0: "QB",
  1: "TQB",
  2: "RB",
  3: "RB/WR",
  4: "WR",
  5: "WR/TE",
  6: "TE",
  7: "UTIL",
  8: "DT",
  9: "DE",
  10: "LB",
  11: "DL",
  12: "CB",
  13: "S",
  14: "DB",
  15: "DP",
  16: "D/ST",
  17: "K",
  18: "P",
  19: "HC",
  20: "BN",
  21: "IR",
  23: "FLEX",
  24: "OP",
  25: "RWT",
};

/** Order used when rendering a roster: starters, flex, special teams, bench, IR. */
export const SLOT_ORDER: Record<number, number> = {
  0: 0, 2: 1, 4: 2, 6: 3, 3: 4, 5: 4, 7: 5, 23: 5, 24: 5, 25: 5,
  16: 6, 17: 7, 20: 8, 21: 9,
};

export const isBenchSlot = (slotId: number): boolean => slotId === 20 || slotId === 21;

export const positionColor = (pos: string): string => {
  switch (pos) {
    case "QB": return "#e06a7a";
    case "RB": return "#7aa5e0";
    case "WR": return "#7ec98f";
    case "TE": return "#d9b36c";
    case "K": return "#a58ee0";
    case "D/ST": return "#6fc7c7";
    default: return "#97908a";
  }
};
