import { env, isCategory, type Category, type PublishMode } from "./env.ts";
import { fetchJson, fetchText, HttpError } from "./http.ts";
import { findPublication, publicationKey, recordPublication } from "./publications.ts";
import { duplicateKey } from "./normalize.ts";
import { updateCandidate } from "./candidates.ts";

export interface ArticlePayload {
  candidateId: number;
  url: string;
  title: string;
  content: string;
  excerpt?: string;
  category: Category;
  sourceUrl: string;
}

export interface PublishResult {
  duplicate: boolean;
  remoteId: string | null;
  remoteUrl: string | null;
  status: string;
  publishMode: PublishMode;
}

export async function publishArticle(payload: ArticlePayload): Promise<PublishResult> {
  if (!isCategory(payload.category)) {
    throw new Error(`Invalid category: ${payload.category}`);
  }
  const settings = env();
  if (!settings.usinagem360ApiUrl) {
    throw new Error("USINAGEM360_API_URL is required to publish");
  }
  const keys = duplicateKey(payload.sourceUrl, payload.title);
  const idempotencyKey = publicationKey(keys.urlHash, keys.titleHash);
  const existing = await findPublication(idempotencyKey);
  if (existing) {
    return {
      duplicate: true,
      remoteId: existing.remoteId,
      remoteUrl: existing.remoteUrl,
      status: existing.status,
      publishMode: existing.publishMode,
    };
  }

  const remote =
    settings.usinagem360ApiKind === "generic"
      ? await publishGeneric(payload, settings.publishMode, idempotencyKey)
      : await publishWordpress(payload, settings.publishMode, idempotencyKey);

  const publication = await recordPublication({
    candidateId: payload.candidateId,
    urlHash: keys.urlHash,
    titleHash: keys.titleHash,
    remoteId: remote.id,
    remoteUrl: remote.url,
    publishMode: settings.publishMode,
    status: settings.publishMode === "publish" ? "published" : "draft",
  });

  await updateCandidate(payload.candidateId, {
    status: settings.publishMode === "publish" ? "published" : "drafted",
    category: payload.category,
  });

  return {
    duplicate: false,
    remoteId: publication.remoteId,
    remoteUrl: publication.remoteUrl,
    status: publication.status,
    publishMode: publication.publishMode,
  };
}

async function publishWordpress(
  payload: ArticlePayload,
  mode: PublishMode,
  idempotencyKey: string,
) {
  const settings = env();
  const base = settings.usinagem360ApiUrl.replace(/\/$/, "");
  const categoryId = await resolveWordpressCategory(base, payload.category);
  const body = {
    title: payload.title,
    content: payload.content,
    excerpt: payload.excerpt ?? "",
    status: mode === "publish" ? "publish" : "draft",
    categories: categoryId ? [categoryId] : [],
    meta: {
      pollard_source_url: payload.sourceUrl,
      pollard_idempotency_key: idempotencyKey,
    },
  };
  const created = await fetchJson<{ id: number; link?: string }>(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: wordpressAuth(),
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  return { id: String(created.id), url: created.link ?? null };
}

async function resolveWordpressCategory(base: string, category: Category): Promise<number | null> {
  try {
    const rows = await fetchJson<Array<{ id: number; slug: string }>>(
      `${base}/wp-json/wp/v2/categories?slug=${encodeURIComponent(category)}`,
      { headers: { authorization: wordpressAuth() } },
    );
    return rows[0]?.id ?? null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

function wordpressAuth(): string {
  const settings = env();
  if (settings.usinagem360ApiToken) {
    return `Bearer ${settings.usinagem360ApiToken}`;
  }
  if (!settings.usinagem360ApiUser || !settings.usinagem360ApiPassword) {
    throw new Error("Usinagem360 WordPress credentials are missing");
  }
  const token = Buffer.from(
    `${settings.usinagem360ApiUser}:${settings.usinagem360ApiPassword}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

async function publishGeneric(
  payload: ArticlePayload,
  mode: PublishMode,
  idempotencyKey: string,
) {
  const settings = env();
  const endpoint = settings.usinagem360ApiUrl.replace(/\/$/, "");
  const created = await fetchJson<{ id?: string | number; url?: string }>(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: settings.usinagem360ApiToken
        ? `Bearer ${settings.usinagem360ApiToken}`
        : wordpressAuth(),
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      title: payload.title,
      content: payload.content,
      excerpt: payload.excerpt ?? "",
      category: payload.category,
      source_url: payload.sourceUrl,
      status: mode,
      idempotency_key: idempotencyKey,
    }),
  });
  return { id: created.id != null ? String(created.id) : null, url: created.url ?? null };
}

export async function pingUsinagem360(): Promise<{ ok: boolean; error?: string; ms: number }> {
  const settings = env();
  if (!settings.usinagem360ApiUrl) {
    return { ok: false, error: "USINAGEM360_API_URL unset", ms: 0 };
  }
  const started = Date.now();
  try {
    const base = settings.usinagem360ApiUrl.replace(/\/$/, "");
    const url =
      settings.usinagem360ApiKind === "generic"
        ? base
        : `${base}/wp-json/`;
    await fetchText(url, { method: "GET" }, { retries: 0, timeoutMs: 5000 });
    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    };
  }
}
