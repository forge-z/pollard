import { defineTool } from "eve/tools";
import { z } from "zod";
import { discoverNews, ingestDiscovered, recordHeartbeat } from "@pollard/core";

export default defineTool({
  description:
    "Busca RSS, SearXNG e, se necessário, Google News. Filtra duplicatas e fontes de press release. Não usa LLM.",
  inputSchema: z.object({}),
  async execute() {
    const discovered = await discoverNews();
    const ingested = await ingestDiscovered(discovered.items);
    await recordHeartbeat("radar", true, {
      found: discovered.items.length,
      created: ingested.created.length,
      duplicates: ingested.duplicates,
      errors: discovered.errors,
    });
    return {
      found: discovered.items.length,
      created: ingested.created.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.source,
        national: item.national,
        summary: item.summary.slice(0, 280),
      })),
      duplicates: ingested.duplicates,
      errors: discovered.errors,
    };
  },
});
