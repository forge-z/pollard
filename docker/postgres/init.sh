#!/bin/bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE pollard_radar' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pollard_radar')\gexec
  SELECT 'CREATE DATABASE pollard_editor' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pollard_editor')\gexec
  SELECT 'CREATE DATABASE pollard_ops' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pollard_ops')\gexec
EOSQL
