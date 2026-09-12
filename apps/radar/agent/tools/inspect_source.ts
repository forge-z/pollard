import { defineTool } from "eve/tools";
import { z } from "zod";
import { inspectSource } from "@pollard/core";

export default defineTool({
  description: "Baixa a página original e devolve texto limpo para verificação factual.",
  inputSchema: z.object({
    url: z.string().url(),
  }),
  async execute({ url }) {
    return inspectSource(url);
  },
});
