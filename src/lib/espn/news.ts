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

/**
 * Best-effort web search: ESPN's search endpoint first, then a keyword
 * filter over the latest NFL news, then the raw news front page.
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const url =
      "https://site.api.espn.com/apis/common/v3/search?query=" +
      encodeURIComponent(q) +
      "&limit=8";
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (res.ok) {
      const json = (await res.json()) as Record<string, any>;
      const raw: any[] = [
        ...((json.articles as any[]) ?? []),
        ...((json.results as any[]) ?? []),
        ...((json.athletes as any[]) ?? []),
      ];
      const items = raw
        .map((r) => ({
          title: String(r?.headline ?? r?.title ?? r?.displayName ?? "").trim(),
          snippet: String(r?.description ?? r?.summary ?? "").trim(),
          url: String(r?.links?.web?.href ?? r?.webUrl ?? r?.href ?? ""),
        }))
        .filter((r) => r.title.length > 0)
        .slice(0, 8);
      if (items.length > 0) return items;
    }
  } catch {
    // fall through to news
  }

  const news = await getNflNews(40);
  const needle = q.toLowerCase();
  const filtered = news
    .filter((n) => `${n.headline} ${n.description}`.toLowerCase().includes(needle))
    .map((n) => ({ title: n.headline, snippet: n.description, url: n.url }));
  if (filtered.length > 0) return filtered.slice(0, 8);

  return news
    .slice(0, 6)
    .map((n) => ({ title: n.headline, snippet: n.description, url: n.url }));
}
