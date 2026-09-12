import { defineTool } from "eve/tools";
import { z } from "zod";
import { countTodayOutputs, env } from "@pollard/core";

export default defineTool({
  description: "Consulta a cota diária e o modo de publicação configurado.",
  inputSchema: z.object({}),
  async execute() {
    const settings = env();
    const used = await countTodayOutputs();
    return {
      used,
      limit: settings.dailyArticleLimit,
      remaining: Math.max(0, settings.dailyArticleLimit - used),
      publishMode: settings.publishMode,
    };
  },
});
