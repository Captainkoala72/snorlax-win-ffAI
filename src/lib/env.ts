function pick(...values: Array<string | undefined>): string {
  return values.find((v) => v?.trim())?.trim() ?? "";
}
export const env = {
  leagueId: pick(process.env.LEAGUE_ID, process.env.ESPN_LEAGUE_ID),
  swid: pick(process.env.ESPN_SWID, process.env.SWID),
  espnS2: pick(process.env.ESPN_S2, process.env.espn_s2),
  zaiApiKey: pick(process.env.ZAI_API_KEY),
  baseUrl: "https://api.z.ai/api/paas/v4",
  model: "glm-5.3-flash",
  season: Number(pick(process.env.SEASON_YEAR, process.env.ESPN_SEASON)) || new Date().getFullYear(),
} as const;
export type ReasoningEffort = "max";
export const REASONING_EFFORTS: Array<{ id: ReasoningEffort; label: string; hint: string }> = [
  { id: "max", label: "Max", hint: "Maximum reasoning for fantasy decisions" },
];
