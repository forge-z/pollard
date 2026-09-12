import { defineTool } from "eve/tools";
import { z } from "zod";
import { listCandidates } from "@pollard/core";

export default defineTool({
  description: "Lista candidatos recentes no banco editorial.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(20).optional(),
  }),
  async execute({ limit }) {
    return listCandidates(["new", "queued"], limit ?? 10);
  },
});
