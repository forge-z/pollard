CREATE SCHEMA IF NOT EXISTS pollard;

CREATE TABLE IF NOT EXISTS pollard.candidates (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  title_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  original_excerpt TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ,
  found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  relevance_score INTEGER,
  relevance_notes TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  national BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (url_hash)
);

CREATE INDEX IF NOT EXISTS candidates_status_idx ON pollard.candidates (status, found_at DESC);
CREATE INDEX IF NOT EXISTS candidates_title_hash_idx ON pollard.candidates (title_hash);

CREATE TABLE IF NOT EXISTS pollard.publications (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT REFERENCES pollard.candidates(id),
  url_hash TEXT NOT NULL,
  title_hash TEXT NOT NULL,
  remote_id TEXT,
  remote_url TEXT,
  publish_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pollard.heartbeats (
  agent TEXT PRIMARY KEY,
  ok BOOLEAN NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pollard.alerts (
  id BIGSERIAL PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alerts_fingerprint_idx ON pollard.alerts (fingerprint, sent_at DESC);
