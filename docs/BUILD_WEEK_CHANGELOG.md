# Build Week change boundary — legacy Expo phase

> The later standalone rebuild is entirely contained in `apps/keyp-web`; see the root README for the current before/after boundary.

This repository existed before OpenAI Build Week. The baseline is commit `a14dd2f` on `main`. This file separates prior work from work created for the July 13–22, 2026 submission period.

## Before Build Week

- Expo/React Native Korean and English client
- Express/PostgreSQL API
- Interest parsing and serial Planner → Collector → Verifier → Deliverer pipeline
- Background polling and push notifications
- URL reachability/SSRF gate, dead URL blacklist, freshness floor, semantic deduplication
- Feedback personalization, plans, quotas, source preferences, admin views, legal pages
- GPT-5.4 planner, Perplexity collector, Claude verifier through Replit AI integrations

## Added during Build Week

- Official OpenAI Agents SDK runtime with explicit GPT-5.6 model selection
- IntentRefiner and QueryDecomposer agents
- Six parallel specialist search lanes
- Public adapters for Bluesky, Hacker News, GDELT, SearXNG, and RSSHub/RSS
- Four parallel GPT-5.6 judges: credibility, relevance, freshness, novelty
- Deterministic weighted fusion and judge hard gates
- GPT-5.6 multilingual editor
- Swarm metrics and automatic legacy fallback
- Expanded typed platform taxonomy across OpenAPI, server, and client UI
- Deterministic swarm unit tests
- Architecture, open-source attribution, Replit setup, demo, and Devpost evidence documents
- Removed a previously committed VAPID private key from `.replit`; rotation is required

## Evidence locations

| Claim                 | Evidence                                             |
| --------------------- | ---------------------------------------------------- |
| GPT-5.6 Agents SDK    | `artifacts/api-server/src/services/swarm/runtime.ts` |
| Parallel source lanes | `runtime.ts`, `collector.ts`                         |
| Public adapters       | `sourceAdapters.ts`                                  |
| Deterministic gates   | `utils.ts`, `routes/agents.ts`                       |
| Tests                 | `utils.test.ts`                                      |
| API contract          | `lib/api-spec/openapi.yaml`                          |
| Build Week branch     | `buildweek-gpt56-swarm`                              |

Use the final Build Week commit hashes and the Codex `/feedback` session ID in the Devpost submission after the branch is pushed.
