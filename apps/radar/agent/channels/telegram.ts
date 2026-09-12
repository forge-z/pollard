import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";
import { listCandidates } from "@pollard/core";

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  credentials: {
    botToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
    webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  },
  async onMessage(ctx, message) {
    const command = message.text.trim().split(/\s+/)[0]?.replace(/@.*$/, "") ?? "";
    if (command === "/help") {
      await ctx.telegram.sendMessage("Pollard Radar\n/status — resumo\n/scan — iniciar busca");
      return null;
    }
    if (command === "/status") {
      const queued = await listCandidates(["queued", "new"], 8);
      const lines = queued.map((item) => `#${item.id} ${item.title}`).slice(0, 8);
      await ctx.telegram.sendMessage(
        lines.length
          ? `Radar com ${queued.length} candidatos:\n${lines.join("\n")}`
          : "Radar sem candidatos novos.",
      );
      return null;
    }
    return {
      auth: defaultTelegramAuth(message),
      title: command === "/scan" ? "Radar scan" : undefined,
    };
  },
});
