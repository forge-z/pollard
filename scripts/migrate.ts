import { migrateEditorialSchema, withRetry } from "@pollard/core";

await withRetry(
  async () => {
    await migrateEditorialSchema();
  },
  {
    retries: 12,
    delayMs: 2000,
  },
);

console.log("Pollard editorial schema is ready");
