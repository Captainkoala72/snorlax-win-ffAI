import { env } from "../env";
// Public ESPN news + search, used for the AI's web-search grounding.

export interface NewsItem {
  headline: string;
  description: string;
  published: string;
  source: string;
  url: string;
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

const NEWS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=";

export async function getNflNews(limit = 20): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${NEWS_URL}${Math.min(Math.max(limit, 1), 50)}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { articles?: any[] };
    return (json.articles ?? [])
      .map((a) => ({
        headline: String(a?.headline ?? "").trim(),
        description: String(a?.description ?? "").trim(),
        published: String(a?.published ?? ""),
        source: String(a?.source ?? "ESPN"),
        url: String(a?.links?.web?.href ?? ""),
      }))
      .filter((n) => n.headline.length > 0);
  } catch {
    return [];
  }
}

/** Search the wider web through Z.AI, preserving source links. */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  if (!env.zaiApiKey) throw new Error("ZAI_API_KEY is required for web search.");
  const res = await fetch(env.baseUrl + "/web_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.zaiApiKey },
    body: JSON.stringify({ search_engine: "search-prime", search_query: query.trim(), count: 8 }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("Z.AI web search failed (HTTP " + res.status + ").");
  const data = await res.json();
  if (!Array.isArray(data.search_result)) throw new Error("Z.AI returned an invalid search response.");
  return data.search_result.map((r: { title?: string; content?: string; link?: string }) => ({
    title: r.title ?? "", snippet: r.content ?? "", url: r.link ?? "",
  }));
}
