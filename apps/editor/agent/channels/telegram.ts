import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";
import { countTodayOutputs, listCandidates } from "@pollard/core";

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  credentials: {
    botToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
    webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  },
  async onMessage(ctx, message) {
    const command = message.text.trim().split(/\s+/)[0]?.replace(/@.*$/, "") ?? "";
    if (command === "/help") {
      await ctx.telegram.sendMessage(
        "Pollard Editor\n/status — cota e fila\n/pending — candidatos\n/write — processar a fila",
      );
      return null;
    }
    if (command === "/status" || command === "/pending") {
      const pending = await listCandidates(["queued"], 8);
      const used = await countTodayOutputs();
      await ctx.telegram.sendMessage(
        `Editor: ${used} peças hoje.\nFila: ${pending.length}\n${pending
          .map((item) => `#${item.id} ${item.title}`)
          .join("\n")}`.trim(),
      );
      return null;
    }
    return {
      auth: defaultTelegramAuth(message),
      title: command === "/write" ? "Editor write" : undefined,
    };
  },
});
