import type { Category } from "./env.ts";
import { query } from "./db.ts";
import { duplicateKey, startOfUtcDay } from "./normalize.ts";

export type CandidateStatus =
  | "new"
  | "rejected"
  | "queued"
  | "writing"
  | "published"
  | "drafted"
  | "skipped";

export interface Candidate {
  id: number;
  url: string;
  urlHash: string;
  title: string;
  titleHash: string;
  source: string;
  summary: string;
  originalExcerpt: string;
  publishedAt: Date | null;
  foundAt: Date;
  relevanceScore: number | null;
  relevanceNotes: string | null;
  category: Category | null;
  status: CandidateStatus;
  national: boolean;
}

export interface CandidateInput {
  url: string;
  title: string;
  source: string;
  summary?: string;
  originalExcerpt?: string;
  publishedAt?: Date | null;
  relevanceScore?: number | null;
  relevanceNotes?: string | null;
  category?: Category | null;
  status?: CandidateStatus;
  national?: boolean;
}

export async function findDuplicate(url: string, title: string): Promise<Candidate | null> {
  const keys = duplicateKey(url, title);
  const result = await query<CandidateRow>(
    `SELECT * FROM pollard.candidates
     WHERE url_hash = $1 OR title_hash = $2
     ORDER BY id ASC
     LIMIT 1`,
    [keys.urlHash, keys.titleHash],
  );
  return result.rows[0] ? toCandidate(result.rows[0]) : null;
}

export async function saveCandidate(input: CandidateInput): Promise<{
  candidate: Candidate;
  created: boolean;
  duplicate: boolean;
}> {
  const existing = await findDuplicate(input.url, input.title);
  if (existing) {
    return { candidate: existing, created: false, duplicate: true };
  }
  const keys = duplicateKey(input.url, input.title);
  try {
    const result = await query<CandidateRow>(
      `INSERT INTO pollard.candidates (
        url, url_hash, title, title_hash, source, summary, original_excerpt,
        published_at, relevance_score, relevance_notes, category, status, national
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        input.url,
        keys.urlHash,
        input.title,
        keys.titleHash,
        input.source,
        input.summary ?? "",
        input.originalExcerpt ?? "",
        input.publishedAt ?? null,
        input.relevanceScore ?? null,
        input.relevanceNotes ?? null,
        input.category ?? null,
        input.status ?? "new",
        input.national ?? false,
      ],
    );
    return { candidate: toCandidate(result.rows[0]), created: true, duplicate: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await findDuplicate(input.url, input.title);
      if (duplicate) {
        return { candidate: duplicate, created: false, duplicate: true };
      }
    }
    throw error;
  }
}

export async function listCandidates(status: CandidateStatus[] = ["queued", "new"], limit = 10) {
  const result = await query<CandidateRow>(
    `SELECT * FROM pollard.candidates
     WHERE status = ANY($1)
     ORDER BY national DESC, relevance_score DESC NULLS LAST, found_at DESC
     LIMIT $2`,
    [status, limit],
  );
  return result.rows.map(toCandidate);
}

export async function getCandidate(id: number): Promise<Candidate | null> {
  const result = await query<CandidateRow>(`SELECT * FROM pollard.candidates WHERE id = $1`, [id]);
  return result.rows[0] ? toCandidate(result.rows[0]) : null;
}

export async function updateCandidate(
  id: number,
  patch: Partial<
    Pick<
      Candidate,
      | "status"
      | "relevanceScore"
      | "relevanceNotes"
      | "category"
      | "originalExcerpt"
      | "national"
    >
  >,
): Promise<Candidate | null> {
  const result = await query<CandidateRow>(
    `UPDATE pollard.candidates SET
      status = COALESCE($2, status),
      relevance_score = COALESCE($3, relevance_score),
      relevance_notes = COALESCE($4, relevance_notes),
      category = COALESCE($5, category),
      original_excerpt = COALESCE($6, original_excerpt),
      national = COALESCE($7, national)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      patch.status ?? null,
      patch.relevanceScore ?? null,
      patch.relevanceNotes ?? null,
      patch.category ?? null,
      patch.originalExcerpt ?? null,
      patch.national ?? null,
    ],
  );
  return result.rows[0] ? toCandidate(result.rows[0]) : null;
}

export async function countTodayOutputs(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM pollard.publications
     WHERE created_at >= $1
       AND status IN ('draft', 'publish', 'drafted', 'published')`,
    [startOfUtcDay()],
  );
  return Number(result.rows[0]?.count ?? 0);
}

interface CandidateRow {
  id: string;
  url: string;
  url_hash: string;
  title: string;
  title_hash: string;
  source: string;
  summary: string;
  original_excerpt: string;
  published_at: Date | null;
  found_at: Date;
  relevance_score: number | null;
  relevance_notes: string | null;
  category: Category | null;
  status: CandidateStatus;
  national: boolean;
}

function toCandidate(row: CandidateRow): Candidate {
  return {
    id: Number(row.id),
    url: row.url,
    urlHash: row.url_hash,
    title: row.title,
    titleHash: row.title_hash,
    source: row.source,
    summary: row.summary,
    originalExcerpt: row.original_excerpt,
    publishedAt: row.published_at,
    foundAt: row.found_at,
    relevanceScore: row.relevance_score,
    relevanceNotes: row.relevance_notes,
    category: row.category,
    status: row.status,
    national: row.national,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
