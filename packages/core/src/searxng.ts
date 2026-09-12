import { fetchJson } from "./http.ts";
import { isWithinHours } from "./normalize.ts";

export interface SearchHit {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date | null;
  engine: string;
}

interface SearxngResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    publishedDate?: string;
    engine?: string;
  }>;
}

export async function searchSearxng(
  baseUrl: string,
  query: string,
  windowHours: number,
): Promise<SearchHit[]> {
  const endpoint = new URL("/search", baseUrl);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("language", "pt-BR");
  endpoint.searchParams.set("time_range", windowHours <= 24 ? "day" : "week");
  const payload = await fetchJson<SearxngResponse>(endpoint.toString());
  return (payload.results ?? [])
    .map((result) => {
      if (!result.title || !result.url) return null;
      const publishedAt = result.publishedDate ? new Date(result.publishedDate) : null;
      if (publishedAt && Number.isNaN(publishedAt.getTime())) return null;
      if (publishedAt && !isWithinHours(publishedAt, windowHours)) return null;
      return {
        title: result.title,
        url: result.url,
        summary: result.content ?? "",
        publishedAt,
        engine: result.engine ?? "searxng",
      } satisfies SearchHit;
    })
    .filter((item): item is SearchHit => Boolean(item));
}
