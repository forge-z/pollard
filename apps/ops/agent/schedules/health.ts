import { defineSchedule } from "eve/schedules";
import {
  formatHealthReport,
  recordAlert,
  recordHeartbeat,
  runHealthChecks,
  sendTelegram,
  shouldAlert,
} from "@pollard/core";

export default defineSchedule({
  cron: process.env.OPS_CRON ?? "*/10 * * * *",
  async run() {
    const report = await runHealthChecks();
    await recordHeartbeat("ops", report.ok, {
      checks: report.checks.map((check) => ({
        name: check.name,
        ok: check.ok,
        detail: check.detail,
      })),
    });
    if (report.ok) return;
    const message = formatHealthReport(report);
    const fingerprint = report.checks
      .filter((check) => !check.ok)
      .map((check) => check.name)
      .join(",");
    if (await shouldAlert(fingerprint)) {
      await sendTelegram(message);
      await recordAlert(fingerprint, message);
    }
  },
});
