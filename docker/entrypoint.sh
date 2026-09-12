#!/bin/sh
set -eu

APP="${POLLARD_APP:-radar}"
PORT="${PORT:-3000}"

echo "Pollard entrypoint app=${APP} port=${PORT}"

node --experimental-strip-types /app/scripts/migrate.ts

if [ -n "${WORKFLOW_POSTGRES_URL:-}" ]; then
  echo "Bootstrapping Workflow Postgres world"
  npx --yes --package=@workflow/world-postgres@5.0.0-beta.42 bootstrap
fi

cd "/app/apps/${APP}"
exec npx eve start --host 0.0.0.0 --port "${PORT}"
