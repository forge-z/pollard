import { query } from "./db.ts";
import { sha256 } from "./normalize.ts";
import type { PublishMode } from "./env.ts";

export interface Publication {
  id: number;
  candidateId: number | null;
  urlHash: string;
  titleHash: string;
  remoteId: string | null;
  remoteUrl: string | null;
  publishMode: PublishMode;
  status: string;
  idempotencyKey: string;
}

export function publicationKey(urlHash: string, titleHash: string): string {
  return sha256(`${urlHash}:${titleHash}`);
}

export async function findPublication(idempotencyKey: string): Promise<Publication | null> {
  const result = await query<PublicationRow>(
    `SELECT * FROM pollard.publications WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  return result.rows[0] ? toPublication(result.rows[0]) : null;
}

export async function recordPublication(input: {
  candidateId: number | null;
  urlHash: string;
  titleHash: string;
  remoteId?: string | null;
  remoteUrl?: string | null;
  publishMode: PublishMode;
  status: string;
}): Promise<Publication> {
  const idempotencyKey = publicationKey(input.urlHash, input.titleHash);
  const existing = await findPublication(idempotencyKey);
  if (existing) return existing;
  try {
    const result = await query<PublicationRow>(
      `INSERT INTO pollard.publications (
        candidate_id, url_hash, title_hash, remote_id, remote_url, publish_mode, status, idempotency_key
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        input.candidateId,
        input.urlHash,
        input.titleHash,
        input.remoteId ?? null,
        input.remoteUrl ?? null,
        input.publishMode,
        input.status,
        idempotencyKey,
      ],
    );
    return toPublication(result.rows[0]);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      const duplicate = await findPublication(idempotencyKey);
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

interface PublicationRow {
  id: string;
  candidate_id: string | null;
  url_hash: string;
  title_hash: string;
  remote_id: string | null;
  remote_url: string | null;
  publish_mode: PublishMode;
  status: string;
  idempotency_key: string;
}

function toPublication(row: PublicationRow): Publication {
  return {
    id: Number(row.id),
    candidateId: row.candidate_id ? Number(row.candidate_id) : null,
    urlHash: row.url_hash,
    titleHash: row.title_hash,
    remoteId: row.remote_id,
    remoteUrl: row.remote_url,
    publishMode: row.publish_mode,
    status: row.status,
    idempotencyKey: row.idempotency_key,
  };
}
