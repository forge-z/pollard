import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: process.env.RADAR_CRON ?? "0 14,18,23 * * *",
  markdown: `Execute a busca editorial das últimas 24 horas.

Use scan_sources, inspecione as fontes originais mais promissoras, grave apenas candidatos relevantes e envie um status final. Não publique. Se não houver notícia confiável, não invente.`,
});
