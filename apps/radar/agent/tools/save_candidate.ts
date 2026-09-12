import { defineTool } from "eve/tools";
import { z } from "zod";
import { isCategory, updateCandidate } from "@pollard/core";

export default defineTool({
  description:
    "Atualiza um candidato já ingerido com relevância, categoria e se deve ir para o Editor.",
  inputSchema: z.object({
    id: z.number().int(),
    relevanceScore: z.number().int().min(0).max(100),
    relevanceNotes: z.string().min(1),
    category: z.enum(["usinagem", "industria", "tecnologia", "negocios"]),
    national: z.boolean(),
    accept: z.boolean(),
  }),
  async execute(input) {
    if (!isCategory(input.category)) {
      throw new Error("invalid category");
    }
    const candidate = await updateCandidate(input.id, {
      relevanceScore: input.relevanceScore,
      relevanceNotes: input.relevanceNotes,
      category: input.category,
      national: input.national,
      status: input.accept ? "queued" : "rejected",
    });
    if (!candidate) {
      return { ok: false, error: "candidate not found" };
    }
    return { ok: true, candidate };
  },
});
