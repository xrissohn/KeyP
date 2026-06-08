// ────────────────────────────────────────────────────────────────────────
// Master kill switch for ALL paid AI pipeline activity:
//   - Planner   (OpenAI)
//   - Collector (Perplexity / OpenRouter)
//   - Verifier  (Anthropic)
// and the background poller (pollerCron) that drives them automatically.
//
// While this is `false`:
//   - the background poller does NOT start (no automatic AI spend), and
//   - /agents/parse-interest and /agents/generate-alerts return 503 instead
//     of calling any LLM.
//
// To re-enable AI features, set this back to `true` (or run with the env var
// KEYP_AI_ENABLED=true) and restart the API Server workflow.
// ────────────────────────────────────────────────────────────────────────
export const AI_ENABLED = process.env["KEYP_AI_ENABLED"] === "true" ? true : false;
