import { defineTool } from "eve/tools";
import { z } from "zod";
import { updateCandidate } from "@pollard/core";

export default defineTool({
  description: "Descarta um candidato sem publicar, com o motivo.",
  inputSchema: z.object({
    candidateId: z.number().int(),
    reason: z.string().min(5),
  }),
  async execute({ candidateId, reason }) {
    const candidate = await updateCandidate(candidateId, {
      status: "skipped",
      relevanceNotes: reason,
    });
    if (!candidate) return { ok: false, error: "candidate not found" };
    return { ok: true, candidate };
  },
});
