const PRESS_RELEASE_HOSTS = [
  "prnewswire.com",
  "globenewswire.com",
  "businesswire.com",
  "researchandmarkets.com",
  "marketresearch.com",
  "marketsandmarkets.com",
  "accesswire.com",
  "einpresswire.com",
];

const DEFAULT_FEEDS = [
  "https://www.modernmachineshop.com/rss",
  "https://www.mmsonline.com/rss",
  "https://www.productionmachining.com/rss",
  "https://www.ctemag.com/rss.xml",
  "https://www.automacaoindustrial.info/feed",
  "https://www.industria40.com.br/feed",
  "https://www.automotivebusiness.com.br/rss",
  "https://www.tecmundo.com.br/rss",
];

export function defaultFeeds(): string[] {
  return [...DEFAULT_FEEDS];
}

export function isUnreliableEditorialSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return PRESS_RELEASE_HOSTS.some(
      (blocked) => host === blocked || host.endsWith(`.${blocked}`),
    );
  } catch {
    return true;
  }
}

export const searxngQueries = [
  "usinagem CNC",
  "máquina-ferramenta",
  "automação industrial",
  "robótica industrial",
  "manufatura",
  "ferramentas de corte",
];
