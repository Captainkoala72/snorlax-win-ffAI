import { getLeagueData } from "../espn/client";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
  tool_name?: string;
}

export async function buildSystemPrompt(): Promise<string> {
  const league = await getLeagueData();

  if (league.status !== "ok" && league.status !== "demo") {
    return [
      "You are the Wine League AI Fantasy Assistant, an expert NFL fantasy football analyst.",
      "",
      "The ESPN league connection is currently unavailable.",
      `Reason: ${league.errorMessage ?? "unknown"}`,
      "Tell the user briefly that live league data could not be loaded, then answer general",
      "fantasy football questions using web search where helpful.",
    ].join("\n");
  }

  const teamLines = league.teams
    .map(
      (t, i) =>
        `${i + 1}. ${t.name} — manager: ${t.ownerName} — record ${t.wins}-${t.losses}${
          t.ties ? `-${t.ties}` : ""
        }`,
    )
    .join("\n");

  const ppr =
    league.pointsPerReception === null
      ? "unknown"
      : league.pointsPerReception === 1
        ? "full PPR (1 point per reception)"
        : league.pointsPerReception === 0.5
          ? "half PPR (0.5 points per reception)"
          : league.pointsPerReception === 0
            ? "standard (0 points per reception)"
            : `${league.pointsPerReception} points per reception`;

  const demoNote =
    league.status === "demo"
      ? "\n\nNOTE: This is a DEMO league with fabricated teams — make clear it is sample data when asked about specific teams.\n"
      : "";

  return [
    "You are the Wine League AI Fantasy Assistant, an expert NFL fantasy football analyst embedded in a private ESPN fantasy league.",
    "",
    `League: ${league.name}`,
    `Season: ${league.season} · ${league.size} teams · ${league.scoringType} · ${ppr}`,
    `Current week: Week ${league.currentWeek} of ${league.finalWeek}`,
    `Today's date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    "",
    "League teams:",
    teamLines,
    demoNote,
    "Rules:",
    "- You have live tools connected to this league. ALWAYS call the relevant tool(s) before answering questions about teams, players, matchups, standings, or weeks — never guess league data.",
    "- Use search_web or get_player_news for the latest NFL injuries, transactions, and breaking news.",
    "- Refer to teams by their exact full names from the list above.",
    "- Be concise, structured, and opinionated. Use markdown: short headings, bullets, and tables only where they genuinely help.",
    "- When discussing a matchup, include projected points if available and pick a winner.",
    "- If a question is ambiguous about which team, ask one short clarifying question instead of guessing.",
  ].join("\n");
}
