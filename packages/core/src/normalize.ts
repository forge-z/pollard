import { createHash } from "node:crypto";

export function canonicalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }
  const tracking = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
  ];
  for (const key of tracking) {
    url.searchParams.delete(key);
  }
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function duplicateKey(url: string, title: string): { urlHash: string; titleHash: string } {
  return {
    urlHash: sha256(canonicalizeUrl(url)),
    titleHash: sha256(normalizeTitle(title)),
  };
}

export function isWithinHours(date: Date, hours: number, now = new Date()): boolean {
  return now.getTime() - date.getTime() <= hours * 60 * 60 * 1000 && date.getTime() <= now.getTime() + 5 * 60 * 1000;
}

export function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
