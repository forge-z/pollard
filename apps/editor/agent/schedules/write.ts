import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: process.env.EDITOR_CRON ?? "30 14,18,23 * * *",
  markdown: `Processe a fila do Radar.

Consulte a cota diária, verifique a fonte original de cada candidato, escreva somente o que a fonte sustenta e envie pela ferramenta de publicação. O modo padrão é draft. Se não houver candidato confiável, não invente matéria.`,
});
