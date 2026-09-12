import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalizeUrl, duplicateKey, normalizeTitle } from "../packages/core/src/normalize.ts";
import { htmlToText } from "../packages/core/src/html.ts";
import { isUnreliableEditorialSource } from "../packages/core/src/sources.ts";
import { parseRss } from "../packages/core/src/rss.ts";
import { splitTelegram } from "../packages/core/src/telegram.ts";

test("canonicalizeUrl strips tracking and trailing slash", () => {
  const url = canonicalizeUrl(
    "HTTPS://Example.com/News/Post/?utm_source=rss&utm_medium=feed#frag",
  );
  assert.equal(url, "https://example.com/News/Post");
});

test("duplicate keys match equivalent titles", () => {
  const a = duplicateKey("https://site.com/a", "Máquina CNC nova");
  const b = duplicateKey("https://site.com/a/", "maquina cnc nova!");
  assert.equal(a.urlHash, b.urlHash);
  assert.equal(a.titleHash, b.titleHash);
});

test("htmlToText removes scripts and keeps readable text", () => {
  const text = htmlToText(
    "<html><head><script>alert(1)</script></head><body><h1>Peça</h1><p>Corte &amp; usinagem</p></body></html>",
  );
  assert.match(text, /Peça/);
  assert.match(text, /Corte & usinagem/);
  assert.doesNotMatch(text, /alert/);
});

test("press-release hosts are rejected", () => {
  assert.equal(isUnreliableEditorialSource("https://www.prnewswire.com/news/1"), true);
  assert.equal(isUnreliableEditorialSource("https://www.modernmachineshop.com/news/1"), false);
});

test("parseRss keeps items inside the window", () => {
  const now = new Date();
  const xml = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>Centro de usinagem</title>
      <link>https://exemplo.com/a</link>
      <pubDate>${now.toUTCString()}</pubDate>
      <description>Fábrica em São Paulo</description>
    </item>
    <item>
      <title>Velha</title>
      <link>https://exemplo.com/old</link>
      <pubDate>${new Date(now.getTime() - 80 * 60 * 60 * 1000).toUTCString()}</pubDate>
    </item>
  </channel></rss>`;
  const items = parseRss(xml, "https://exemplo.com/feed", 24);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Centro de usinagem");
});

test("telegram messages split under the limit", () => {
  const chunks = splitTelegram("a".repeat(5000), 4000);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 4000));
});

test("normalizeTitle is accent-insensitive", () => {
  assert.equal(normalizeTitle("Usinagem"), normalizeTitle("usinagem"));
  assert.equal(normalizeTitle("São Paulo"), "sao paulo");
});
