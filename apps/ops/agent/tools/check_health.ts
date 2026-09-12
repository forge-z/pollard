import { defineTool } from "eve/tools";
import { z } from "zod";
import { formatHealthReport, runHealthChecks } from "@pollard/core";

export default defineTool({
  description: "Executa checks HTTP e de banco, sem chamar o modelo.",
  inputSchema: z.object({}),
  async execute() {
    const report = await runHealthChecks();
    return { ...report, text: formatHealthReport(report) };
  },
});
