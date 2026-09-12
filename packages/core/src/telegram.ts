import { env } from "./env.ts";
import { fetchJson } from "./http.ts";
import { query } from "./db.ts";

export async function sendTelegram(text: string, chatId = env().telegramChatId): Promise<void> {
  const token = env().telegramBotToken;
  if (!token || !chatId) return;
  const chunks = splitTelegram(text);
  for (const chunk of chunks) {
    await fetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    });
  }
}

export function splitTelegram(text: string, max = 4000): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < max / 2) cut = max;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function shouldAlert(fingerprint: string, windowMinutes = 30): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM pollard.alerts
     WHERE fingerprint = $1 AND sent_at > NOW() - ($2::text || ' minutes')::interval`,
    [fingerprint, String(windowMinutes)],
  );
  return Number(result.rows[0]?.count ?? 0) === 0;
}

export async function recordAlert(fingerprint: string, message: string): Promise<void> {
  await query(`INSERT INTO pollard.alerts (fingerprint, message) VALUES ($1, $2)`, [
    fingerprint,
    message,
  ]);
}
