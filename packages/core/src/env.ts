const CATEGORIES = ["usinagem", "industria", "tecnologia", "negocios"] as const;

export type Category = (typeof CATEGORIES)[number];
export type PublishMode = "draft" | "publish";
export type AgentName = "radar" | "editor" | "ops";
export type AiProvider = "deepseek" | "openai-compatible";

function read(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function required(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function integer(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return parsed;
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export const categories = CATEGORIES;

export function env() {
  const publishMode = (read("PUBLISH_MODE", "draft") as PublishMode) || "draft";
  if (publishMode !== "draft" && publishMode !== "publish") {
    throw new Error("PUBLISH_MODE must be draft or publish");
  }

  const aiProvider = (read("AI_PROVIDER", "deepseek").toLowerCase() ||
    "deepseek") as AiProvider;
  if (aiProvider !== "deepseek" && aiProvider !== "openai-compatible") {
    throw new Error("AI_PROVIDER must be deepseek or openai-compatible");
  }

  return {
    agentName: (read("POLLARD_AGENT", "radar") || "radar") as AgentName,
    databaseUrl: required("DATABASE_URL"),
    workflowPostgresUrl: read("WORKFLOW_POSTGRES_URL"),
    aiProvider,
    deepseekApiKey: read("DEEPSEEK_API_KEY"),
    deepseekModel: read("DEEPSEEK_MODEL", "deepseek-v4-flash"),
    deepseekBaseUrl: read("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    openaiCompatibleApiKey: read("OPENAI_COMPATIBLE_API_KEY"),
    openaiCompatibleBaseUrl: read("OPENAI_COMPATIBLE_BASE_URL"),
    openaiCompatibleModel: read("OPENAI_COMPATIBLE_MODEL"),
    modelContextWindowTokens: integer("MODEL_CONTEXT_WINDOW_TOKENS", 128_000),
    searxngUrl: read("SEARXNG_URL"),
    rssFeeds: splitList(read("RSS_FEEDS")),
    googleNewsQuery: read(
      "GOOGLE_NEWS_QUERY",
      "usinagem OR CNC OR \"máquina-ferramenta\" OR manufatura",
    ),
    researchWindowHours: integer("RESEARCH_WINDOW_HOURS", 24),
    dailyArticleLimit: integer("DAILY_ARTICLE_LIMIT", 3),
    publishMode,
    usinagem360ApiUrl: read("USINAGEM360_API_URL"),
    usinagem360ApiKind: read("USINAGEM360_API_KIND", "wordpress") || "wordpress",
    usinagem360ApiUser: read("USINAGEM360_API_USER"),
    usinagem360ApiPassword: read("USINAGEM360_API_PASSWORD"),
    usinagem360ApiToken: read("USINAGEM360_API_TOKEN"),
    telegramBotToken: read("TELEGRAM_BOT_TOKEN"),
    telegramWebhookSecret: read("TELEGRAM_WEBHOOK_SECRET_TOKEN"),
    telegramChatId: read("TELEGRAM_CHAT_ID"),
    telegramBotUsername: read("TELEGRAM_BOT_USERNAME"),
    radarHealthUrl: read("RADAR_HEALTH_URL"),
    editorHealthUrl: read("EDITOR_HEALTH_URL"),
    opsHealthUrl: read("OPS_HEALTH_URL"),
    routeAuthUser: read("ROUTE_AUTH_BASIC_USER"),
    routeAuthPassword: read("ROUTE_AUTH_BASIC_PASSWORD"),
    httpTimeoutMs: integer("HTTP_TIMEOUT_MS", 15_000),
    httpRetries: integer("HTTP_RETRIES", 2),
  };
}

export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
