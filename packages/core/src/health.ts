import { env } from "./env.ts";
import { checkDatabase, query } from "./db.ts";
import { checkHttp } from "./http.ts";
import { pingUsinagem360 } from "./usinagem360.ts";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

export async function runHealthChecks(): Promise<{
  ok: boolean;
  checks: CheckResult[];
}> {
  const settings = env();
  const checks: CheckResult[] = [];

  const database = await checkDatabase();
  checks.push({
    name: "postgres",
    ok: database.ok,
    detail: database.error ?? "ok",
    ms: database.ms,
  });

  if (settings.radarHealthUrl) {
    const radar = await checkHttp(`${settings.radarHealthUrl.replace(/\/$/, "")}/eve/v1/health`);
    checks.push({
      name: "radar",
      ok: radar.ok,
      detail: radar.error ?? `HTTP ${radar.status ?? "?"}`,
      ms: radar.ms,
    });
  }

  if (settings.editorHealthUrl) {
    const editor = await checkHttp(`${settings.editorHealthUrl.replace(/\/$/, "")}/eve/v1/health`);
    checks.push({
      name: "editor",
      ok: editor.ok,
      detail: editor.error ?? `HTTP ${editor.status ?? "?"}`,
      ms: editor.ms,
    });
  }

  if (settings.searxngUrl) {
    let searx = await checkHttp(new URL("/healthz", settings.searxngUrl).toString());
    if (!searx.ok) {
      searx = await checkHttp(settings.searxngUrl);
    }
    checks.push({
      name: "searxng",
      ok: searx.ok,
      detail: searx.error ?? `HTTP ${searx.status ?? "?"}`,
      ms: searx.ms,
    });
  }

  if (settings.usinagem360ApiUrl) {
    const cms = await pingUsinagem360();
    checks.push({
      name: "usinagem360",
      ok: cms.ok,
      detail: cms.error ?? "ok",
      ms: cms.ms,
    });
  }

  const stale = await staleAgents();
  checks.push(...stale);

  return { ok: checks.every((check) => check.ok), checks };
}

async function staleAgents(): Promise<CheckResult[]> {
  const result = await query<{ agent: string; ok: boolean; checked_at: Date }>(
    `SELECT agent, ok, checked_at FROM pollard.heartbeats`,
  );
  const now = Date.now();
  return result.rows
    .filter((row) => row.agent !== "ops")
    .map((row) => {
      const ageMs = now - new Date(row.checked_at).getTime();
      const stale = ageMs > 6 * 60 * 60 * 1000;
      return {
        name: `heartbeat:${row.agent}`,
        ok: row.ok && !stale,
        detail: stale
          ? `last seen ${Math.round(ageMs / 60000)}m ago`
          : row.ok
            ? "ok"
            : "last run reported failure",
        ms: ageMs,
      };
    });
}

export async function recordHeartbeat(
  agent: string,
  ok: boolean,
  detail: Record<string, unknown>,
): Promise<void> {
  await query(
    `INSERT INTO pollard.heartbeats (agent, ok, detail, checked_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (agent) DO UPDATE SET ok = EXCLUDED.ok, detail = EXCLUDED.detail, checked_at = NOW()`,
    [agent, ok, JSON.stringify(detail)],
  );
}

export function formatHealthReport(result: { ok: boolean; checks: CheckResult[] }): string {
  const lines = result.checks.map(
    (check) => `${check.ok ? "OK" : "FAIL"} ${check.name}: ${check.detail} (${check.ms}ms)`,
  );
  return [`Pollard Ops ${result.ok ? "saudável" : "com falhas"}`, ...lines].join("\n");
}
