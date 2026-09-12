import { defineTool } from "eve/tools";
import { z } from "zod";
import { sendTelegram } from "@pollard/core";

export default defineTool({
  description: "Envia um resumo curto ao Telegram do Radar.",
  inputSchema: z.object({
    message: z.string().min(1).max(3500),
  }),
  async execute({ message }) {
    await sendTelegram(message);
    return { sent: true };
  },
});
