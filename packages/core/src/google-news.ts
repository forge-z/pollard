import { fetchRssFeed } from "./rss.ts";
import type { RssItem } from "./rss.ts";

export function googleNewsFeedUrl(query: string): string {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  url.searchParams.set("ceid", "BR:pt-419");
  return url.toString();
}

export async function fetchGoogleNews(query: string, windowHours: number): Promise<RssItem[]> {
  return fetchRssFeed(googleNewsFeedUrl(query), windowHours);
}
