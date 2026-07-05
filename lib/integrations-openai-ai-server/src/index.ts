import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (!baseURL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL is not set. Run setupReplitAIIntegrations to provision it.",
  );
}
if (!apiKey) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY is not set. Run setupReplitAIIntegrations to provision it.",
  );
}

export const openai: OpenAI = new OpenAI({
  baseURL,
  apiKey,
});

export type { OpenAI };
