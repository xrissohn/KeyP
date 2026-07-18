# Devpost submission working draft

**Do not paste this draft verbatim.** The entrant should rewrite it in their own voice, replace every placeholder, and describe only behavior verified in the final public deployment.

## Required fields

| Field                     | Draft / action                                                              |
| ------------------------- | --------------------------------------------------------------------------- |
| Project name              | KeyP                                                                        |
| Tagline                   | The signal, not the noise — verified real-time alerts from the public world |
| Category                  | Apps for Your Life                                                          |
| Submitter type            | `[select the truthful option]`                                              |
| Country                   | South Korea                                                                 |
| Repository                | `https://github.com/xrissohn/KeyP`                                          |
| Public test URL           | `[REPLIT_DEPLOYMENT_URL]`                                                   |
| Demo video                | `[PUBLIC_YOUTUBE_URL, under 3 minutes]`                                     |
| Codex feedback session ID | `[RUN /feedback AND PASTE SESSION ID]`                                      |
| Deadline                  | July 22, 2026 09:00 KST                                                     |

## Inspiration — rewrite in your voice

Information is abundant, but attention and timing are scarce. A person following an AI launch, local opportunity, creator, trip, or community has to repeat the same search across platforms and languages, then decide which links are real, current, and genuinely new. KeyP was built to deliver the next trustworthy development without making the user live inside search boxes.

## What it does — rewrite in your voice

The user describes an interest naturally in Korean or English. KeyP converts it into a structured monitoring plan and dispatches bounded specialists across official sources, breaking news, public social posts, videos, communities, and Korean sources. Exact URLs are checked, stale underlying events and semantic duplicates are removed, and four GPT‑5.6 judges independently evaluate credibility, relevance, freshness, and novelty. The highest-signal findings become concise multilingual alert cards and push notifications with direct links to the original source.

## How we built it — rewrite and personalize

- Expo/React Native app with an Express 5 and PostgreSQL backend
- OpenAI Agents SDK using explicit `gpt-5.6` agents
- Six concurrent Perplexity Sonar Pro public-web source scouts
- Concurrent Bluesky, Hacker News, GDELT, optional SearXNG, and RSS adapters
- Deterministic SSRF-safe URL verification, semantic deduplication, event-time floor, and weighted score fusion
- Replit AI integrations for model gateways; no API key in source control
- Codex for repository audit, implementation, type-contract changes, tests, documentation, and Build Week evidence

## Challenges — rewrite in your voice

The hardest part was separating “published recently” from “the event happened recently.” A newly published recap can be information garbage for someone already following a live story. KeyP therefore carries both publication age and event age and enforces a strict freshness floor outside the model. Another challenge was broad platform coverage without pretending every platform has an unrestricted API. We use bounded public-web research and optional compliant adapters, never private-account scraping.

## Accomplishments — verify before using

- Small, specialized agents with two true parallel fan-outs
- Hard product invariants implemented outside prompts
- Graceful per-agent and whole-pipeline fallbacks
- Typed source coverage across client and server
- Auditable Build Week boundary for a pre-existing product
- Operational metrics that make parallel execution visible in the live response

## What we learned — rewrite in your voice

Parallel agents are most valuable when their scopes are orthogonal and the final decision is deterministic. Specialized judges also make failures understandable: a candidate can be fresh but not credible, or credible but already known. Open-source components work best as replaceable interfaces, not as a pile of copied repositories.

## What's next — keep realistic

- Add approved first-party credentials and webhooks for more social platforms
- Persist per-dimension judge scores for long-term evaluation
- Build a labeled human evaluation set for Korean/English alert quality
- Add source-corroboration graphs and notification-level explanations
- Publish operator recipes for SearXNG and RSSHub deployment

## Submission evidence checklist

- [ ] Public repository contains final Build Week commits after baseline `a14dd2f`
- [ ] README setup works on a fresh Replit import
- [ ] `KEYP_AI_ENABLED=true` in deployed Replit Secrets
- [ ] Existing VAPID private key rotated; replacement exists only in Replit Secrets
- [ ] Public test URL opens without editor access
- [ ] Demo is public, under 3 minutes, has audio, mentions Codex and GPT‑5.6
- [ ] Demo shows live `steps`, `metrics.model=gpt-5.6`, working links, and non-repetition
- [ ] `/feedback` session ID added
- [ ] Submission clearly distinguishes prior product from Build Week work
- [ ] All claims match the deployed build
