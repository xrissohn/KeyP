import { resolve } from "node:path";

export function loadEnvironment(): void {
  if (process.env.OPENAI_API_KEY) return;
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env.local"),
  ];
  for (const candidate of candidates) {
    try {
      process.loadEnvFile(candidate);
      if (process.env.OPENAI_API_KEY) return;
    } catch {
      // Continue to the next standard local path.
    }
  }
}
