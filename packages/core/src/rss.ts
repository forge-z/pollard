import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./http.ts";
import { isWithinHours } from "./normalize.ts";

export interface RssItem {
  title: string;
  url: string;
  publishedAt: Date | null;
  summary: string;
  source: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
});

export async function fetchRssFeed(url: string, windowHours: number): Promise<RssItem[]> {
  const { text } = await fetchText(url);
  return parseRss(text, url, windowHours);
}

export function parseRss(xml: string, feedUrl: string, windowHours: number): RssItem[] {
  const parsed = parser.parse(xml);
  const items = collectItems(parsed);
  const source = feedUrl;
  return items
    .map((item) => toRssItem(item, source))
    .filter((item): item is RssItem => Boolean(item))
    .filter((item) => !item.publishedAt || isWithinHours(item.publishedAt, windowHours));
}

function collectItems(parsed: Record<string, unknown>): Record<string, unknown>[] {
  const rss = asRecord(parsed.rss);
  const channel = rss ? asRecord(rss.channel) : undefined;
  const atom = asRecord(parsed.feed);
  const raw = channel?.item ?? atom?.entry ?? [];
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (isRecord(raw)) return [raw];
  return [];
}

function toRssItem(item: Record<string, unknown>, source: string): RssItem | null {
  const title = textOf(item.title);
  const url = firstUrl(item);
  if (!title || !url) return null;
  const publishedAt = parseDate(
    textOf(item.pubDate) || textOf(item.published) || textOf(item.updated) || textOf(item.date),
  );
  const summary = textOf(item.description) || textOf(item.summary) || textOf(item.content) || "";
  return { title, url, publishedAt, summary: stripTags(summary), source };
}

function firstUrl(item: Record<string, unknown>): string | null {
  const link = item.link;
  if (typeof link === "string" && link.startsWith("http")) return link.trim();
  if (isRecord(link) && typeof link.href === "string") return link.href;
  if (Array.isArray(link)) {
    for (const entry of link) {
      if (typeof entry === "string" && entry.startsWith("http")) return entry;
      if (isRecord(entry) && typeof entry.href === "string") return entry.href;
    }
  }
  const guid = item.guid;
  if (typeof guid === "string" && guid.startsWith("http")) return guid;
  if (isRecord(guid) && typeof guid.text === "string" && guid.text.startsWith("http")) {
    return guid.text;
  }
  return null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (isRecord(value) && typeof value.text === "string") return value.text.trim();
  return "";
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}
