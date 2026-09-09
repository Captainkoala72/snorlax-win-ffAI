// Centralized environment configuration for Wine League.
// Every secret is read independently so the league can be re-pointed
// without touching code.

function pick(...vals: Array<string | undefined>): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export const env = {
  /** ESPN fantasy league id (numeric string from the league URL). */
  leagueId: pick(process.env.LEAGUE_ID),
  /** SWID cookie value for ESPN private league access. */
  swid: pick(process.env.ESPN_SWID, process.env.SWID),
  /** espn_s2 cookie value for ESPN private league access. */
  espnS2: pick(process.env.ESPN_S2, process.env.ESPN_S2),
  /** Meta Model API key (Muse Spark 1.3). */
  metaApiKey: pick(
    process.env.META_API_KEY,
    process.env.MODEL_API_KEY,
    process.env.MUSE_SPARK_API_KEY,
  ),
  /** Base URL of the Meta Model API (OpenAI-compatible surface). */
  baseUrl: (pick(process.env.MUSE_SPARK_BASE_URL) || "https://api.meta.ai/v1").replace(/\/+$/, ""),
  /** Model id served by the Meta endpoint. */
  model: pick(process.env.MUSE_SPARK_MODEL) || "muse-spark-1.3",
  /** NFL season to inspect on ESPN. */
  season: Number(pick(process.env.SEASON_YEAR) || "2026") || 2026,
} as const;

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export const REASONING_EFFORTS: Array<{ id: ReasoningEffort; label: string; hint: string }> = [
  { id: "minimal", label: "Minimal", hint: "Fastest answers, light reasoning" },
  { id: "low", label: "Low", hint: "Quick analysis for simple questions" },
  { id: "medium", label: "Medium", hint: "Balanced depth and speed" },
  { id: "high", label: "High", hint: "Deep analysis for matchups and trades" },
  { id: "xhigh", label: "xHigh", hint: "Maximum reasoning for big decisions" },
];
