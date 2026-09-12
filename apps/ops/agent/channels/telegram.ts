import { telegramChannel } from "eve/channels/telegram";
import { formatHealthReport, runHealthChecks } from "@pollard/core";

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  credentials: {
    botToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
    webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  },
  async onMessage(ctx, message) {
    const command = message.text.trim().split(/\s+/)[0]?.replace(/@.*$/, "") ?? "";
    if (command === "/help") {
      await ctx.telegram.sendMessage("Pollard Ops\n/status — checks HTTP, banco e heartbeats");
      return null;
    }
    if (command === "/status" || command === "/health") {
      const report = await runHealthChecks();
      await ctx.telegram.sendMessage(formatHealthReport(report));
      return null;
    }
    if (command.startsWith("/")) {
      await ctx.telegram.sendMessage("Comando não reconhecido. Use /status.");
      return null;
    }
    return null;
  },
});
