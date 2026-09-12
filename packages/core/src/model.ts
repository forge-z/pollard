import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export function createPollardModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER ?? "deepseek").trim().toLowerCase();

  if (provider === "openai-compatible") {
    const compatible = createOpenAICompatible({
      name: "openai-compatible",
      apiKey: process.env.OPENAI_COMPATIBLE_API_KEY ?? "",
      baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://127.0.0.1:4000/v1",
    });
    return compatible(process.env.OPENAI_COMPATIBLE_MODEL ?? "gpt-4.1-mini");
  }

  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });
  return deepseek.chat(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash");
}

export function pollardAgentConfig() {
  return {
    defaultTools: false as const,
    model: createPollardModel(),
    modelContextWindowTokens: Number.parseInt(
      process.env.MODEL_CONTEXT_WINDOW_TOKENS ?? "128000",
      10,
    ),
    limits: {
      maxInputTokensPerSession: 200_000,
      maxOutputTokensPerSession: 20_000,
    },
    experimental: {
      workflow: {
        world: "@workflow/world-postgres",
      },
    },
    build: {
      externalDependencies: [
        "@workflow/world-postgres",
        "pg",
        "@pollard/core",
        "@ai-sdk/deepseek",
        "@ai-sdk/openai-compatible",
      ],
    },
  };
}
