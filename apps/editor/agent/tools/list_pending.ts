import { defineTool } from "eve/tools";
import { z } from "zod";
import { listCandidates } from "@pollard/core";

export default defineTool({
  description: "Lista candidatos aceitos pelo Radar e ainda não publicados.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(10).optional(),
  }),
  async execute({ limit }) {
    return listCandidates(["queued"], limit ?? 5);
  },
});
