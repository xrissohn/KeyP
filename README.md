# KeyP — the signal, not the noise

KeyP turns a natural-language interest into continuously verified, multilingual alerts from the public web. Instead of asking one model to search, judge, translate, and rank at once, KeyP decomposes the work into small specialists and runs the independent stages in parallel.

> OpenAI Build Week 2026 · **Apps for Your Life** · Existing project, meaningfully extended after July 13 on `buildweek-gpt56-swarm`

![KeyP home feed](screenshots/keyp-04-home.jpg)

## What changed for Build Week

The pre-event KeyP app already had an Expo client, Express API, persistence, notifications, and a serial Planner → Collector → Verifier → Deliverer pipeline. The Build Week extension adds:

- OpenAI Agents SDK orchestration with `gpt-5.6` intent, decomposition, four independent judge, and multilingual editor agents.
- Six bounded source scouts running concurrently: official, breaking news, social, video, communities, and Korea.
- Concurrent public-source adapters for Bluesky, Hacker News, GDELT, optional SearXNG, and optional RSSHub/RSS feeds.
- Exact-URL reachability checks, SSRF-safe redirect handling, semantic deduplication, strict event-time freshness, and deterministic score fusion.
- Run metrics for candidate counts, source coverage, elapsed time, and estimated parallel speedup.
- Explicit source types for X, Facebook, Instagram, TikTok, Threads, Bluesky, Mastodon, Naver Blog, Hacker News, news, YouTube, Reddit, and RSS.

See [Build Week changelog](docs/BUILD_WEEK_CHANGELOG.md) for the auditable before/after boundary.

## Architecture

![KeyP GPT-5.6 swarm architecture](docs/agent-interactions.png)

1. `IntentRefiner` turns the saved interest into a precise, privacy-safe monitoring objective.
2. `QueryDecomposer` creates exactly six bounded source tasks.
3. The six Perplexity scouts and five public adapters run concurrently.
4. A deterministic URL gate rejects dead, fabricated, private-network, and soft-404 links.
5. Four GPT-5.6 judges independently score credibility, relevance, freshness, and novelty.
6. A deterministic weighted ranker fuses scores; `MultilingualEditor` writes the final Korean or English alert without changing the source URL.
7. If the new swarm fails, KeyP automatically falls back to the existing production pipeline. Set `KEYP_SWARM_MODE=strict` to expose failures during evaluation or `off` for instant rollback.

Technical details: [architecture](docs/ARCHITECTURE.md) · [open-source components](docs/OPEN_SOURCE_COMPONENTS.md)

## Run on Replit

This branch is designed to use the AI integrations already connected to the Replit project. It does **not** need a separately pasted `OPENAI_API_KEY`.

1. Import or pull this GitHub branch into the existing Replit project.
2. Confirm the Replit OpenAI and OpenRouter AI integrations are connected. Replit injects:
   - `AI_INTEGRATIONS_OPENAI_BASE_URL`
   - `AI_INTEGRATIONS_OPENAI_API_KEY`
   - `AI_INTEGRATIONS_OPENROUTER_BASE_URL`
   - `AI_INTEGRATIONS_OPENROUTER_API_KEY`
3. In Replit Secrets, set `KEYP_AI_ENABLED=true` and `KEYP_SWARM_MODE=primary`.
4. Optional: set `SEARXNG_BASE_URL`, `KEYP_RSS_FEEDS` (comma-separated feed URLs), `KEYP_SWARM_MODEL`, or `KEYP_SEARCH_MODEL`.
5. Rotate the previously committed VAPID key and store the replacement only as `VAPID_PRIVATE_KEY` in Replit Secrets.
6. Press **Run**. The Replit `Project` workflow starts the API and Expo web app.

The current feature flag intentionally defaults paid AI features to off. A live AI smoke test requires `KEYP_AI_ENABLED=true`; unit tests and builds do not.

## Local verification

Requirements: Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm run typecheck:libs
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/api-server test:swarm
pnpm --filter @workspace/api-server build
```

The deterministic tests do not call paid models. A live Replit test can POST the same interest twice to `/api/agents/generate-alerts`; verify that the second response does not repeat the first response's `existingAlertSummaries`, every source URL opens, and `metrics.model` is `gpt-5.6`.

## Open-source strategy

KeyP integrates maintained components rather than copying large projects into the repository:

- [`openai/openai-agents-js`](https://github.com/openai/openai-agents-js) for agent execution.
- [`searxng/searxng`](https://github.com/searxng/searxng) through its optional JSON API.
- [`DIYgod/RSSHub`](https://github.com/DIYgod/RSSHub) through standard RSS endpoints.
- Bluesky public API, Hacker News Algolia API, and GDELT DOC API through small native adapters.
- `rss-parser` for feed normalization.

Platforms such as X, Facebook, Instagram, TikTok, YouTube, Reddit, and Naver differ in public API availability and terms. KeyP searches only publicly accessible content through the web-research lane and never bypasses authentication, scrapes private profiles, or deanonymizes people.

## Repository map

```text
artifacts/keyp/                 Expo / React Native app
artifacts/api-server/           Express API and background pipeline
  src/services/swarm/           Build Week multi-agent extension
lib/api-spec/                   OpenAPI source of truth
lib/api-zod/                    Runtime validation and shared types
docs/                           Architecture, evidence, demo, submission draft
```

## Safety and privacy

- Public information only; no private-account access or login bypass.
- No private-person identification, profiling, or deanonymization.
- Every LLM-supplied URL passes protocol, DNS, redirect, private-IP, status, and soft-404 gates.
- Previously delivered stories are blocked semantically even when another publisher rewrites them.
- Event time outranks republish time; silence is preferred to stale or fabricated information.
- Secrets stay in Replit Secrets and are never committed.

## Build Week evidence

- Branch: `buildweek-gpt56-swarm`
- Baseline commit: `a14dd2f`
- New implementation: `artifacts/api-server/src/services/swarm/`
- Model: `gpt-5.6`, explicit in code and runtime metrics
- SDK: `@openai/agents`
- Submission checklist and demo script: [docs/DEVPOST_SUBMISSION_DRAFT.md](docs/DEVPOST_SUBMISSION_DRAFT.md), [docs/DEMO_SCRIPT_KO.md](docs/DEMO_SCRIPT_KO.md)

## License

MIT. Third-party components retain their own licenses; see [docs/OPEN_SOURCE_COMPONENTS.md](docs/OPEN_SOURCE_COMPONENTS.md).
