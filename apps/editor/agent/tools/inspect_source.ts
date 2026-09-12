import { defineTool } from "eve/tools";
import { z } from "zod";
import { inspectSource } from "@pollard/core";

export default defineTool({
  description: "Baixa e lê a fonte original antes de redigir. Obrigatório.",
  inputSchema: z.object({
    url: z.string().url(),
  }),
  async execute({ url }) {
    return inspectSource(url);
  },
});
