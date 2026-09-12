import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  countTodayOutputs,
  env,
  getCandidate,
  publishArticle,
  recordHeartbeat,
  updateCandidate,
} from "@pollard/core";

export default defineTool({
  description:
    "Envia a matéria à API do Usinagem360. Idempotente. Respeita PUBLISH_MODE. Sem acesso a shell.",
  inputSchema: z.object({
    candidateId: z.number().int(),
    title: z.string().min(8).max(180),
    content: z.string().min(400),
    excerpt: z.string().min(40).max(400).optional(),
    category: z.enum(["usinagem", "industria", "tecnologia", "negocios"]),
  }),
  async execute(input) {
    const settings = env();
    const used = await countTodayOutputs();
    if (used >= settings.dailyArticleLimit) {
      return { ok: false, error: "daily limit reached", used, limit: settings.dailyArticleLimit };
    }
    const candidate = await getCandidate(input.candidateId);
    if (!candidate) {
      return { ok: false, error: "candidate not found" };
    }
    if (candidate.status === "published" || candidate.status === "drafted") {
      return { ok: false, error: "candidate already processed", status: candidate.status };
    }
    await updateCandidate(candidate.id, { status: "writing", category: input.category });
    const result = await publishArticle({
      candidateId: candidate.id,
      url: candidate.url,
      title: input.title,
      content: input.content,
      excerpt: input.excerpt,
      category: input.category,
      sourceUrl: candidate.url,
    });
    await recordHeartbeat("editor", true, {
      candidateId: candidate.id,
      status: result.status,
      duplicate: result.duplicate,
    });
    return { ok: true, ...result };
  },
});
