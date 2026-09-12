import { isTransient, withRetry } from "./retry.ts";

export class HttpError extends Error {
  readonly status: number;
  readonly body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<{ status: number; text: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? Number.parseInt(process.env.HTTP_TIMEOUT_MS ?? "15000", 10);
  const retries = options.retries ?? Number.parseInt(process.env.HTTP_RETRIES ?? "2", 10);

  return withRetry(
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          ...init,
          redirect: init.redirect ?? "follow",
          signal: controller.signal,
          headers: {
            "user-agent": "Pollard/0.1 (+https://usinagem360.com.br)",
            accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
            ...init.headers,
          },
        });
        const text = await response.text();
        if (!response.ok) {
          throw new HttpError(
            `HTTP ${response.status} for ${url}`,
            response.status,
            text.slice(0, 2000),
          );
        }
        return { status: response.status, text, finalUrl: response.url || url };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          const timeout = new Error(`Timeout after ${timeoutMs}ms for ${url}`);
          Object.assign(timeout, { code: "ETIMEDOUT", status: 408 });
          throw timeout;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    { retries, shouldRetry: isTransient },
  );
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const result = await fetchText(url, init, options);
  return JSON.parse(result.text) as T;
}

export async function checkHttp(url: string, timeoutMs = 5000): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  ms: number;
}> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    };
  }
}
