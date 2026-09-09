import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, CalendarRange, Newspaper, Sparkles, TrendingUp, Trophy } from "lucide-react";
import type { TeamSummary } from "./serialize";

export interface TeamPrompt {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  build: (team: TeamSummary, week: number) => string;
}

export const TEAM_PROMPTS: TeamPrompt[] = [
  {
    id: "strengths",
    label: "Analyze strengths",
    hint: "Roster construction",
    icon: Sparkles,
    build: (t) =>
      `Analyze ${t.name}'s strengths, weaknesses, and overall roster construction this season. What is this team's identity?`,
  },
  {
    id: "matchup",
    label: "This week's matchup",
    hint: "Weekly preview",
    icon: CalendarRange,
    build: (t, w) =>
      `Break down ${t.name}'s Week ${w} matchup — projected scores, key players, and who has the edge.`,
  },
  {
    id: "startsit",
    label: "Start / Sit",
    hint: "Lineup advice",
    icon: ArrowLeftRight,
    build: (t) =>
      `Give start/sit recommendations for ${t.name}'s lineup this week, with reasoning for each call.`,
  },
  {
    id: "trade",
    label: "Trade targets",
    hint: "Buy / sell",
    icon: TrendingUp,
    build: (t) =>
      `What is ${t.name}'s biggest roster need? Propose a realistic trade they should make this week.`,
  },
];

export interface LeaguePrompt {
  id: string;
  label: string;
  icon: LucideIcon;
  build: (week: number, finalWeek: number) => string;
}

export const LEAGUE_PROMPTS: LeaguePrompt[] = [
  {
    id: "matchups",
    label: "Break down this week's matchups",
    icon: CalendarRange,
    build: (w) =>
      `Break down every Week ${w} matchup in the league and pick a winner for each game.`,
  },
  {
    id: "power",
    label: "League power rankings",
    icon: Trophy,
    build: () =>
      `Give your power rankings of every team in the league with one sharp sentence of reasoning each.`,
  },
  {
    id: "waivers",
    label: "Top waiver wire targets",
    icon: TrendingUp,
    build: (w, finalWeek) =>
      finalWeek > w
        ? `Who are the best waiver wire targets heading into Week ${w + 1}? Tie the advice to actual roster needs where possible.`
        : `The regular season is over. Review the waiver wire pickups that mattered most this season.`,
  },
  {
    id: "news",
    label: "Latest NFL news impact",
    icon: Newspaper,
    build: () =>
      `What is the most important NFL news right now, and how does it impact the Wine League?`,
  },
];
