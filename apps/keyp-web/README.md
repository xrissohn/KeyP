# KeyP standalone web app

`@keyp/web` is a portable React + Express application. It does not import the legacy Expo app, require Clerk authentication, or depend on Replit's AI integration variables.

## Commands

From the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev:web
corepack pnpm typecheck:web
corepack pnpm test:web
corepack pnpm build:web
corepack pnpm start:web
```

From this package directory, use `corepack pnpm dev`, `typecheck`, `test`, `build`, or `start`.

The Express server serves both `/api/*` and the Vite client. The default port is `4173`.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Live only | — | Server-side OpenAI Platform key |
| `KEYP_MODEL` | No | `gpt-5.6` | Model for every specialist |
| `KEYP_DEMO_MODE` | No | `false` | Force all requests to stable no-cost demo data |
| `KEYP_TRACING_ENABLED` | No | `false` | Enable Agents SDK tracing only when intended |
| `KEYP_LIVE_RUN_LIMIT` | No | `6` | Live runs per client per 10-minute in-memory window |
| `SEARXNG_BASE_URL` | No | — | Optional operator-owned SearXNG JSON endpoint |
| `PORT` | No | `4173` | HTTP port |

Copy `.env.example` to the repository root as `.env.local` for local development. Never commit it and never expose the key through a `VITE_*` variable.

## API

`GET /api/health` reports service readiness without exposing credentials.

`POST /api/runs` accepts:

```json
{
  "interest": "OpenAI Agents SDK와 GPT-5.6의 새로운 공식 발표",
  "language": "ko",
  "freshnessHours": 72,
  "mode": "demo",
  "knownUrls": []
}
```

The response includes the six-lane plan, verified signals, agent events, source coverage, wall-clock time, estimated sequential time, and parallel speedup.

## Package map

```text
src/client/              responsive React signal desk
src/server/index.ts      one-process HTTP/static server
src/server/live.ts       GPT-5.6 Agents SDK orchestration
src/server/publicAdapters.ts  Bluesky/HN/GDELT/SearXNG adapters
src/server/deterministic.ts   URL normalization, dedupe, fusion
src/server/urlSafety.ts       SSRF-safe DNS/redirect/status probe
src/server/demo.ts       stable, no-cost judging fixture
src/shared/contracts.ts  Zod contracts shared by client and server
```
