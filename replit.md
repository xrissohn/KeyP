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

#### Realtime collection (background polling)
- `AppContext` exposes `refreshInterest(id)`, `refreshAllInterests()`, `refreshingInterestIds`, `lastBackgroundRunAt`, `autoCollectEnabled`, `autoCollectIntervalMs`.
- A `useEffect` runs a background sweep every `autoCollectIntervalMs` (default **2 minutes**) that sequentially refreshes every active interest. The first sweep fires 5s after mount.
- **Dedup**: incoming alerts are filtered against existing alerts for the same `interestId` by `source.url` (preferred) and normalized title (fallback). Only genuinely new items are appended.
- **Throttling**: a per-interest `lastRefreshedAt` cooldown (60s) and a single `sweepRunningRef` mutex prevent overlapping or concurrent fetches.
- **Stale-state safety**: `interestsRef` / `alertsRef` mirror the latest state so the polling closure never operates on a stale snapshot.
- **UI**: `(tabs)/interests.tsx` shows a collector status bar (green dot + interval label + "지금 수집" button + auto-collect Switch). `interest/[id].tsx` shows a per-interest "실시간 수집 중 · 마지막 수집: X분 전" row + "지금 수집" button.
- New alerts created by realtime sweeps are stamped `createdAt: now`, so the existing `getNewAlertCount`/NEW-badge logic surfaces them automatically.
- Settings persist to AsyncStorage under `@keyp/autoCollect`.

#### Fresh-start design + push notifications (v2)
- **Empty seed**: `data/mockData.ts` exports `MOCK_INTERESTS=[]`, `MOCK_ALERTS=[]`, `MOCK_MATCHES=[]`. New users start with zero data; everything is collected live.
- **Storage version bump**: `STORAGE_KEYS` now use `@keyp/v2/*` so legacy v1 dummy data is discarded. `loadFromStorage` also `multiRemove`s the old `@keyp/{interests,alerts,matches,autoCollect}` keys on every boot for one-time hygiene.
- **Single-seed semantics**: `addInterest` calls `generateAlertsForSpec(spec, 1)` so registering an interest fetches exactly ONE most-recent past relevant item as the seed alert. All subsequent alerts come from the realtime sweep loop and are de-duped before insertion.
- **Push notifications** (`lib/notifications.ts`):
  - Native: dynamic `import('expo-notifications')` so web bundles never resolve native-only code; `setNotificationHandler` shows banners/list/sound/badge in foreground; Android `setNotificationChannelAsync('keyp-default', { importance: HIGH })` is required for OEM reliability and `scheduleNotificationAsync` passes `{ channelId: 'keyp-default' }` on Android.
  - Web fallback: browser `Notification` API; permission requested once per session.
  - `notifyFreshAlerts(fresh[])` picks the freshest by `createdAt` to avoid spam when a sweep returns multiple.
  - `initNotifications()` is invoked once from the `AppProvider` mount `useEffect`.
  - Hooked from `addInterest` (seed alert) and from `refreshInterest` after dedup (`fresh.length > 0`).
- **Limitation (local-only push)**: notifications are scheduled locally; they fire reliably while the app is foreground or recently backgrounded, but not when the device/app is fully terminated. True remote push (Expo push token + server-side trigger) is a follow-up if delivery while terminated becomes a requirement.

#### Saved-알림 dummy → real bookmark migration (legacy, mostly dormant)
- `data/mockData.ts` seeds two saved alerts (`alert_002`, `alert_005`) with placeholder URLs (e.g. `https://youtube.com`, `https://example.com`) so the **저장한 알림** screen isn't empty on first launch.
- `lib/utils/url.ts` `isPlaceholderUrl()` flags bare-domain URLs from a known set as placeholders; real Perplexity URLs (with paths) are NOT flagged.
- `AppContext` migrates these dummy bookmarks onto genuine fetched alerts via three coordinated layers (all use functional `setAlerts(prev => ...)` so React serializes against latest state):
  1. **Sweep-time migration** inside `refreshInterest`: when fresh real-URL alerts arrive, atomically transfer `isSaved`+`feedback` from any same-interest dummy bookmarks onto the freshest real alert (sorted by `createdAt`). Skips migration if no fresh alert has a non-placeholder URL — prevents moving a bookmark onto another placeholder.
  2. **Eager hydration migration**: a one-shot `useEffect` (gated by `eagerMigrationRanRef`) that runs after `hydrated`. For each dummy bookmark, picks the freshest real-URL alert in the same interest (by `createdAt`) from already-persisted alerts and migrates the bookmark immediately — no API call needed.
  3. **`upgradeSavedDummies()`**: exposed via context, called from `app/saved.tsx` on mount as a safety net for cold-start sessions. Iterates dummy bookmarks and calls `refreshInterest()` for each interest where no real alert (saved or unsaved) yet exists. The actual swap happens via the sweep-time migration above.
- The 60s `lastRefreshedAt` cooldown can delay (not block) migration when upstream returns empty/bad-JSON; retries occur on the next sweep cycle.
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
