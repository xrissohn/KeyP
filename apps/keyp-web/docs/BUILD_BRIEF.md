# KeyP Web rebuild brief

## Confirmed facts

- KeyP turns a natural-language interest into timely, verified signals from the public web.
- The Build Week differentiator is a small, specialized, parallel multi-agent swarm using GPT-5.6.
- Public-source coverage must include official pages, news, social posts, video, communities, and Korean sources without bypassing authentication or platform restrictions.
- The new app must be independent of Expo, React Native, Clerk, and Replit-specific AI gateways.
- It must run locally, on Replit, or on another Node host with ordinary environment variables.

## Product contract

- Input: one interest in natural language, UI language, freshness window, and demo/live mode.
- Output: a refined monitoring objective, ranked signals with exact source URLs, confidence dimensions, agent timeline, source coverage, and elapsed-time metrics.
- State: recent interests and the last successful run are stored in the browser for the MVP; no server-side identity is required.
- Tools: OpenAI Agents SDK hosted web search plus deterministic URL, freshness, deduplication, and score-fusion code.
- Approval boundary: the app only reads public information. It never logs into social networks, changes external data, or accesses private accounts.
- Proof command: `pnpm --filter @keyp/web test && pnpm --filter @keyp/web build`.

## Agent workflow

1. `Intent Architect` structures the interest and creates six bounded source lanes.
2. Six `Signal Scout` agents search official, breaking, social, video, community, and Korea lanes in parallel.
3. Deterministic gates reject invalid, stale, unreachable, and duplicate candidates.
4. Four `Judge` agents score credibility, relevance, freshness, and novelty in parallel.
5. Deterministic weighted fusion selects the strongest signals.
6. `Briefing Editor` writes concise Korean or English copy without changing source URLs.

## Deployment assumptions

- Node.js 22+ and pnpm 11.
- One process serves both the API and the Vite production bundle.
- `OPENAI_API_KEY` is server-only.
- `/api/health` is the readiness endpoint.
- Demo mode stays functional without paid model calls.

## Deferred until the stable web core is proven

- Account authentication and cross-device sync.
- Scheduled background jobs and push notifications.
- First-party social platform credentials.
- Billing and production database migrations.
