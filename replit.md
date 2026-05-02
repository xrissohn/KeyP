# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### KeyP (`artifacts/keyp`) — Mobile App
- **Kind**: Expo React Native (iOS/Android/Web)
- **Slug**: `keyp`, **Preview path**: `/`
- **Purpose**: 한국어 UI 실시간 관심사 알림 + 내부 상호매칭 앱
- **Stack**: Expo Router, AsyncStorage, @expo/vector-icons, expo-haptics

#### Architecture
- **Auth**: Mock auth via AsyncStorage (`context/AuthContext.tsx`)
- **State**: App-wide context (`context/AppContext.tsx`) — interests, alerts, matches
- **AI Pipeline (specialized model per agent role, all via Replit AI Integrations — no user API keys, billed to credits)**:
  - `lib/agents/ApiClient.ts` — fetch wrapper hitting `/api/agents/*` endpoints
  - `lib/agents/PlannerAgent.ts` — calls `POST /api/agents/parse-interest`; keyword fallback on failure
  - `lib/agents/MockPipeline.ts` — calls `POST /api/agents/generate-alerts`; template fallback on failure
  - Server route: `artifacts/api-server/src/routes/agents.ts`
  - **Planner** = OpenAI **gpt-5.4** (`@workspace/integrations-openai-ai-server`) — JSON-mode structured extraction
  - **SourceRouter** = deterministic priority calc (no LLM)
  - **Collector** = Perplexity **`perplexity/sonar`** via OpenRouter (`@workspace/integrations-openrouter-ai`) — real web search returning live URLs/citations
  - **Verifier** = Anthropic **`claude-sonnet-4-6`** (`@workspace/integrations-anthropic-ai`) — credibility & relevance scoring per candidate
  - **Deliverer** = deterministic freshness×confidence sort (no LLM)
  - For `intentType=match`: Collector and Verifier skip LLM calls and use deterministic in-app match logic.
  - **UI**: `app/interest/add.tsx` renders the actual server-returned `steps[]` (not hardcoded labels) via an `onSteps` callback piped through `AppContext.addInterest`. Renderer is server-driven: appends any unknown agents the server emits and uses dynamic total counts (no hardcoded `/5`). Stale callbacks from earlier requests are guarded by a `requestIdRef`.
  - **Source URLs**: `AlertSource.url` is part of the OpenAPI contract. The Collector extracts URLs from Perplexity citations; the Verifier preserves them through scoring; the Deliverer returns them in the response. The mobile client maps `source.url → AlertCard 출처 보기 button`, which calls `Linking.openURL` to open the original source externally.

#### Interest list & history UI
- `components/InterestCard.tsx` renders each interest with a red **NEW <count>** badge when `getNewAlertCount(interestId) > 0` (computed against `interest.lastViewedAt`).
- Tapping a card opens `app/interest/[id].tsx` which shows the interest spec + a newest-first **알림 히스토리** of all alerts for that interest. A `useEffect` calls `markInterestViewed(id)` ~600 ms after mount so the NEW pill is visible briefly before being cleared.
- `components/AlertCard.tsx` shows a "**출처 보기 · <source name>**" button when `alert.source.url` (or `originalUrl`) is present; tapping it calls `Linking.openURL(...)` to leave the app for the original source.
- **Critical invariant**: `Interest.id === Interest.spec.id`. Alerts reference `spec.id` as their `interestId`, so `AppContext.addInterest` assigns `newInterest.id = spec.id` to keep the detail screen filter (`alerts.filter(a => a.interestId === id)`) working. Diverging these IDs makes the history view permanently empty.
- **Types**: `types/index.ts` — InterestSpec, Alert, Match, User, etc.
- **Mock Data**: `data/mockData.ts` — sample interests, alerts, matches

#### Screen Structure
```
app/
  _layout.tsx          # Root layout (AuthProvider > AppProvider > Stack)
  index.tsx            # Entry redirect (auth gate)
  onboarding.tsx       # 3-slide onboarding
  (auth)/
    login.tsx          # Login screen
    register.tsx       # Register screen
  (tabs)/
    _layout.tsx        # NativeTabs (iOS26 liquid glass) / ClassicTabs fallback
    index.tsx          # 피드 — Alert feed with filter chips
    interests.tsx      # 관심사 — Interest management list
    match.tsx          # 매칭 — Reciprocal match feed
    profile.tsx        # 프로필 — User profile + stats
  interest/
    add.tsx            # AI analysis flow (NL → InterestSpec)
    [id].tsx           # Interest detail + related alerts
  alert/[id].tsx       # Alert detail + feedback
  match/[id].tsx       # Match detail + accept/reject
  saved.tsx            # Saved alerts

components/
  AlertCard.tsx        # Notification card (source icon, confidence, feedback)
  InterestCard.tsx     # Interest item (intent badge, sources, alert count)
  MatchCard.tsx        # Match card (score, shared interests, accept/reject)
  ConfidenceBadge.tsx  # Confidence % + freshness indicator
  EmptyState.tsx       # Icon + text empty state
```

#### Colors (Dark Theme)
- Background: `#0A0E1A`, Card: `#141929`
- Primary: `#5B7FFF` (electric blue), Accent: `#FF6B8A` (coral)
- Success: `#4ADE80`, Warning: `#FBBF24`
- Source colors: YouTube `#FF0000`, Twitter `#1D9BF0`, Reddit `#FF4500`

#### Key Design Decisions
- Local persistence via AsyncStorage; agent pipeline calls API server for real LLM
- Server validates LLM JSON output with Zod and falls back deterministically on schema mismatch
- Client sanitizes enum fields and falls back to local templates on transport/error failures
- NativeTabs with liquid glass on iOS 26+, BlurView tab bar on older iOS
- Full Korean UI throughout
- Interest add screen shows step-by-step agent pipeline visualization
