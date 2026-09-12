import { env } from "./env.ts";
import { fetchGoogleNews } from "./google-news.ts";
import { htmlToText, extractTitle } from "./html.ts";
import { fetchText } from "./http.ts";
import { canonicalizeUrl } from "./normalize.ts";
import { fetchRssFeed, type RssItem } from "./rss.ts";
import { searchSearxng, type SearchHit } from "./searxng.ts";
import { defaultFeeds, isUnreliableEditorialSource, searxngQueries } from "./sources.ts";
import { findDuplicate, saveCandidate, type Candidate } from "./candidates.ts";

export interface DiscoveredItem {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: Date | null;
  origin: "rss" | "searxng" | "google-news";
}

export async function discoverNews(): Promise<{
  items: DiscoveredItem[];
  errors: string[];
}> {
  const settings = env();
  const errors: string[] = [];
  const found: DiscoveredItem[] = [];
  const feeds = settings.rssFeeds.length > 0 ? settings.rssFeeds : defaultFeeds();

  for (const feed of feeds) {
    try {
      const items = await fetchRssFeed(feed, settings.researchWindowHours);
      found.push(...items.map((item) => toDiscovered(item, "rss")));
    } catch (error) {
      errors.push(`rss ${feed}: ${errorMessage(error)}`);
    }
  }

  if (settings.searxngUrl) {
    for (const query of searxngQueries) {
      try {
        const hits = await searchSearxng(
          settings.searxngUrl,
          query,
          settings.researchWindowHours,
        );
        found.push(...hits.map((hit) => toDiscovered(hit, "searxng")));
      } catch (error) {
        errors.push(`searxng ${query}: ${errorMessage(error)}`);
      }
    }
  } else {
    errors.push("searxng: SEARXNG_URL unset");
  }

  const afterPrimary = uniqueByUrl(found).filter((item) => !isUnreliableEditorialSource(item.url));
  if (afterPrimary.length === 0) {
    try {
      const fallback = await fetchGoogleNews(
        settings.googleNewsQuery,
        settings.researchWindowHours,
      );
      found.push(...fallback.map((item) => toDiscovered(item, "google-news")));
    } catch (error) {
      errors.push(`google-news: ${errorMessage(error)}`);
    }
  }

  const items = uniqueByUrl(found).filter((item) => !isUnreliableEditorialSource(item.url));
  return { items, errors };
}

export async function inspectSource(url: string): Promise<{
  url: string;
  title: string | null;
  text: string;
}> {
  const { text, finalUrl } = await fetchText(url);
  return {
    url: canonicalizeUrl(finalUrl),
    title: extractTitle(text),
    text: htmlToText(text),
  };
}

export async function ingestDiscovered(items: DiscoveredItem[]): Promise<{
  created: Candidate[];
  duplicates: number;
}> {
  const created: Candidate[] = [];
  let duplicates = 0;
  for (const item of items) {
    const existing = await findDuplicate(item.url, item.title);
    if (existing) {
      duplicates += 1;
      continue;
    }
    const saved = await saveCandidate({
      url: canonicalizeUrl(item.url),
      title: item.title,
      source: item.source,
      summary: item.summary,
      publishedAt: item.publishedAt,
      national: looksNational(item),
      status: "new",
    });
    if (saved.duplicate) duplicates += 1;
    else created.push(saved.candidate);
  }
  return { created, duplicates };
}

function toDiscovered(
  item: RssItem | SearchHit,
  origin: DiscoveredItem["origin"],
): DiscoveredItem {
  return {
    title: item.title,
    url: item.url,
    source: "source" in item ? item.source : item.engine,
    summary: "summary" in item ? item.summary : item.summary,
    publishedAt: item.publishedAt,
    origin,
  };
}

function uniqueByUrl(items: DiscoveredItem[]): DiscoveredItem[] {
  const seen = new Set<string>();
  const unique: DiscoveredItem[] = [];
  for (const item of items) {
    try {
      const key = canonicalizeUrl(item.url);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ ...item, url: key });
    } catch {
      continue;
    }
  }
  return unique;
}

function looksNational(item: DiscoveredItem): boolean {
  const haystack = `${item.url} ${item.title} ${item.source}`.toLowerCase();
  return (
    haystack.includes(".br") ||
    haystack.includes("brasil") ||
    haystack.includes("brazil") ||
    haystack.includes("pt-br")
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
