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
- **State**: App-wide context (`context/AppContext.tsx`) — interests, alerts, matches, language
- **i18n (Korean + English)** (`lib/i18n.ts`): minimal dependency-free `t(key, language, vars?)` over a flat `STRINGS: Record<key, {ko,en}>` table. `useI18n()` hook (re-exported from AppContext to avoid circular imports) returns `{language, t}`. `detectLanguage(locale)` maps any `ko*` locale → `'ko'`, everything else → `'en'`. On boot AppContext hydrates language from AsyncStorage `@keyp/v2/language`; if absent, falls back to `expo-localization`'s device locale. User can change language anytime from onboarding slide 1 (auto-pre-selected) or the Profile → Language row. `languageRef` mirrors current language so callbacks read it without staleness, and is forwarded to the API as `userLanguage` in every `generate-alerts` body. Brand "KeyP", plan tier names, and "속보" are intentionally left identical across languages.
- **Global search + auto-translate** (`artifacts/api-server/src/routes/agents.ts`): the Collector (Perplexity) is told to search the BEST primary source regardless of language (Korean for KR breaking news, English for AI/research, Japanese for JP subculture, etc.) and return title+summary in the source's NATIVE language plus a `originalLanguage` short code. The Verifier (Claude) then translates the kept candidates' title+summary into the request's `userLanguage`, preserving proper nouns/handles/hashtags and never touching `source.url` or `source.name` — users open the original-language source themselves (Google Translate is theirs to run). Per-alert response fields `originalLanguage` and `translated:boolean` flow through the OpenAPI schema. `userLanguage` is whitelist-coerced to `'ko'`/`'en'`, defaulting to `'ko'` for back-compat when missing (e.g. legacy clients, pollerCron loopback when `tracked_interests.spec.userLanguage` is absent).
- **URL reachability gate** (`artifacts/api-server/src/routes/agents.ts`): runs after Collector + backup-collector, before Verifier. HEAD-requests each candidate URL with 5s timeout (GET ranged-fallback for 405/501); drops 404/410/5xx and network failures. SSRF-hardened: rejects non-http(s), embedded creds, non-standard ports, and any host/redirect-hop resolving to loopback/private/link-local/multicast/metadata IPs (IPv4 + IPv6). Empty result → poller silently retries next sweep ("better silence than dead links").
- **Dead-URL blacklist** (`artifacts/api-server/src/services/deadUrlBlacklist.ts`): JSONL persistence at `.local-data/dead-urls.jsonl`, 5000-entry LRU. URL normalization (lowercase host, strip default port, drop trailing slash + fragment + tracking params `utm_*`/`fbclid`/`gclid`). Auto-added on definitive dead (404/410/5xx/soft_404); transient failures (401/403/429/abort) are NOT added. Blacklist is consulted as a pre-filter before URL probing AND its top dead hosts are injected as a hint into Perplexity's primary + backup prompts so the Collector stops surfacing the same dead links.
- **Click-time safety net** (`artifacts/api-server/src/routes/redirect.ts`): `/api/redirect?u=<url>` re-probes the URL on click (GET + soft-404 sniff in EN/KO/JA, narrow markers in `<title>`/`<h1>`/explicit 404 contexts; non-HTML body stream is cancelled to avoid pulling large payloads). If alive → 302 to original. If dead → 302 to a Google search for the article title (a graceful fallback rather than an error page). Also SSRF-guarded. Client-side `buildSafeOpenUrl` (in `AlertCard` and `alert/[id].tsx`) routes all "출처 보기" taps through this proxy, fail-closed when API base is missing.
- **Feedback personalization** (`artifacts/api-server/src/services/feedbackProfile.ts`): JSONL at `.local-data/feedback.jsonl`. Weights `like+2 / more+3 / dislike-3 / hide-2` with 14-day-half-life EMA decay. Unicode tokenizer (Korean/English mixed). Two integration points in `agents.ts`:
  1. **Selector prefilter (선택과 집중)** — between URL gate and Verifier, candidates are scored against the device profile and trimmed to top `KEEP_N` BEFORE the expensive Verifier LLM call. Plan-aware: `free` plan with ≥10 feedback events → aggressive `max(req+2, 4)`; otherwise looser `max(req*2, 6)`. This directly cuts Verifier input tokens and improves precision on the items that DO go through.
  2. **Verifier prompt injection** — when profile is non-empty, a Korean "사용자 선호 신호" section is appended (top/bottom 8 weighted tokens + 3 like/dislike examples), with an anti-overfit guard ("객관적 신뢰도/관련성/최신성보다 우선해서는 안 된다").
  Client wires `setAlertFeedback` → fire-and-forget `POST /push/feedback` (registered-device guard, never throws). `generateAlertsForSpec` forwards both `deviceId` and current `plan` so the server uses the right `KEEP_N`.
- **AI Pipeline (specialized model per agent role, all via Replit AI Integrations — no user API keys, billed to credits)**:
  - `lib/agents/ApiClient.ts` — fetch wrapper hitting `/api/agents/*` endpoints
  - `lib/agents/PlannerAgent.ts` — calls `POST /api/agents/parse-interest`; keyword fallback on failure
  - `lib/agents/MockPipeline.ts` — calls `POST /api/agents/generate-alerts`; template fallback on failure
  - Server route: `artifacts/api-server/src/routes/agents.ts`
  - **Planner** = OpenAI **gpt-5.4** (`@workspace/integrations-openai-ai-server`) — JSON-mode structured extraction. Prompted as a **detective/private-investigator**: in addition to the normalized `InterestSpec`, it must infer a `targetPersona` (who the user is searching FOR — not the asker) and produce a `searchStrategy[]` of 4–7 ordered, named channels (specific subreddits like `r/AskNYC`, X handles, dating-app communities like `Hinge NYC` or `Meeff`, university KSAs, Naver cafes, hashtags) — each with a concrete query and a Korean rationale. Vague inputs MUST still produce ≥4 strategy entries by inferring the most plausible interpretation.
  - **SourceRouter** = deterministic priority calc (no LLM); reports the top channel from `searchStrategy` when present.
  - **Collector** = Perplexity **`perplexity/sonar-pro`** via OpenRouter (`@workspace/integrations-openrouter-ai`) — real web search. Reframed as a "public-content research assistant" so it never refuses person-related queries by interpreting them as PII; explicitly told it searches PUBLIC posts/articles/videos/threads/events ABOUT a topic, not individuals. Receives the Planner's `searchStrategy` as an explicit ordered investigation plan and is instructed to work it in order, falling back to adjacent public content when a specific channel is empty. Hard rule: **never return an empty `alerts` array** — broaden to adjacent content rather than returning nothing.
  - **Verifier** = Anthropic **`claude-sonnet-4-6`** (`@workspace/integrations-anthropic-ai`) — credibility & relevance scoring per candidate.
  - **Deliverer** = deterministic freshness×confidence sort (no LLM). Sort key is **content-recency** = `max(minutesAgo, eventMinutesAgo)`, so a 3-day-old article reporting a 1-hour-old real event beats a 1-hour-old republish of year-old gossip. The Collector now emits `eventHoursAgo` per item (parsed from article body — when the underlying event actually OCCURRED), and the Verifier penalizes stale-republish posts. **Seed guarantee**: when caller asks for `count=1` AND Verifier filtered everything, Deliverer rescues the freshest raw candidate at confidence=55 — but ONLY among candidates that pass the dedup gate, so seed rescue can never violate the prime directive.
  - **Prime directive — strict semantic dedup ("never duplicate")**: GenerateAlertsRequest accepts `existingAlertSummaries: {title,summary}[]` (last ~30 alerts the user already received for that interest). Both Collector and Verifier prompts receive this list; Verifier marks `include=false` for any candidate covering the same story (cross-source/wording) or duplicating an earlier in-batch item. Backup-collector pass also receives the list and the eventHoursAgo requirement. **Final dedup gate** in the Deliverer is the deterministic last line of defense (catches all upstream bypasses including Verifier-fail fallback): character-bigram Jaccard ≥0.45 over normalized `title + summary` (Korean-friendly, agglutinative-aware). Filters against `knownItems` AND in-batch first-occurrence-only. The mobile client (`AppContext.refreshInterest`) collects last-30 existing alerts per interest and forwards them; the server `pollerCron` (push background sweep) does the same from `seen_alerts` (currently `summary=title` since `seen_alerts` schema only stores title — adding a `summary` column is a future-work item to strengthen push-path dedup).
  - **All intent types run real web search** including `intentType=match` — earlier behavior of synthesizing internal mock match candidates was removed; the user wants real-world signals from the platforms where the target persona congregates.
  - **InterestSpec extension**: `lib/api-spec/openapi.yaml` adds `targetPersona: string?` and `searchStrategy: { channel, query, rationale }[]?`. Codegen regenerated; both client and server consume the new fields. Schema names use `*Result` (not `*Response`) to avoid collision with Orval's auto-generated response zod schemas.
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
- **Remote push pipeline (works when app is closed)**: implemented end-to-end via Expo Push Service.
  - **Client** (`lib/deviceId.ts`, `lib/notifications.ts`): on first launch we generate a persistent `deviceId` (`@keyp/v2/deviceId`). `initNotifications()` now also calls `registerExpoPushTokenOnce()` — gets the Expo push token via `getExpoPushTokenAsync({ projectId })` and POSTs `{deviceId, expoPushToken, platform}` to `/api/push/register-device`. `AppContext.addInterest` fires-and-forgets `POST /api/push/track-interest` with the spec; `deleteInterest` fires-and-forgets `DELETE /api/push/track-interest/:id`. All push API calls are non-blocking — failures degrade gracefully to client-side polling.
  - **Server** (`artifacts/api-server`):
    - DB (`lib/db/src/schema/`): `push_devices` (deviceId PK + expoPushToken + platform), `tracked_interests` (interestId PK + deviceId + spec JSONB + lastSweepAt + lastNewAt), `seen_alerts` (composite PK on interestId+dedupKey for idempotent dedup; carries both title AND nullable summary so push-path dedup can run a Jaccard ≥0.45 over `title+summary`, matching client-side strictness), `device_plans` (deviceId PK + plan + boost_quota_used + boost_quota_period + updated_at — source-of-truth for plan and boost quota; survives server restarts and `tracked_interests` rotation).
    - Routes (`routes/push.ts`): `register-device`, `track-interest` (upsert; reads plan from `device_plans` and mirrors into `tracked_interests.spec.plan` for back-compat), `DELETE track-interest/:id` (cascades `seen_alerts`), `set-plan` (upsert into `device_plans`), `boost` (atomic period-rollover UPDATE — single SQL with a `CASE` on `boost_quota_period` so `(used or 0 if rolled over) + 1 <= quota` is checked AND `used` is set to `used+1` (same period) or `1` (new period) in one statement, eliminating any read-then-write race on double-tap), `feedback` (registered-device guard, fire-and-forget shape), `test`.
    - Admin observability (`routes/admin.ts`): `GET /api/admin/stats` returns `{pushDevices, trackedInterests, seenAlerts, blacklist:{size, recent[]}}`. Read-only, counts only — no PII payloads. Useful for confirming the dead-URL blacklist, push pipeline, and feedback ingestion are healthy without inspecting the DB directly.
    - Expo dispatch (`services/expoPush.ts`): single POST to `https://exp.host/--/api/v2/push/send`; tickets with `details.error === "DeviceNotRegistered"` cause the caller to evict the token row.
    - Background poller (`services/pollerCron.ts`, started from `src/index.ts` after `app.listen` with a 5s delay): a 30-second tick picks up to 10 interests whose `lastSweepAt` is NULL or older than 2 minutes, oldest-first. For each it loopbacks to `http://127.0.0.1:$PORT/api/agents/generate-alerts` (count=3, no code duplication of the agent pipeline), dedups candidates against `seen_alerts` by `url` or normalized title, INSERTs all fresh items into `seen_alerts` BEFORE dispatching push (so a crash mid-send can never re-deliver), then sends ONE push for the freshest item with an "(외 N건)" suffix when N>1. `lastSweepAt` always advances so a permanently-broken interest can't starve others. A process-wide `running` mutex prevents overlapping ticks within a single process — multi-instance scaling would need a DB-level row-lock or distributed lock.
  - **OpenAPI**: spec extended in `lib/api-spec/openapi.yaml` with the `push` tag and four endpoints; codegen produces zod validators (`Register/Track/PushTest{Body,Response}`) used by the server to validate inputs and outputs. **Naming caveat**: schemas were named `*Result` (not `*Response`) because Orval already generates `{operationId}Response` from the response body schema and identical names collide in the barrel export.

#### Notification limitations + caveats
- **Expo Go (SDK 53+)** removed remote push from the in-app runtime — `getExpoPushTokenAsync` will throw and the warning is swallowed. To exercise remote push end-to-end you need a dev build (`eas build --profile development`) or a real production build.
- The server-side poller and the client-side sweep both ingest into independent stores (server `seen_alerts` vs client `alerts` array). The client still dedups its own list against `source.url`/title, so you can see both: a push delivered while the app is closed AND the same item appearing in the in-app feed when you reopen.

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

#### Pricing & Cost Optimization (May 2026)
- **Plans**: Free (1h poll, 1 interest), Basic (15m, 5), Pro (10m, 15, 5 boosts/mo), Power (5m, 30, 30 boosts/mo); annual billing -20%.
- **Default cadence**: client foreground refresh and server poller default to 15min (down from 2min) to match Basic-tier economics.
- **Plan storage**: embedded in `tracked_interests.spec` JSONB (no schema migration). New interests inherit plan from device's existing rows. Client persists plan in AsyncStorage and syncs via `/push/set-plan`.
- **Spec-bucket cache**: poller groups identical specs (sha256 of normalized topic/entities/location/sources) and shares Collector+Verifier results across all users for 5 min. Per-interest history is NOT used in the shared call (avoids cross-user dedup poisoning); per-interest dedup happens downstream via `seen_alerts`.
- **In-flight coalescing**: concurrent sweeps for the same bucket await one shared Promise instead of firing duplicate LLM calls.
- **Boost (속보)**: `/push/boost` runs `sweepOne(force=true)`; monthly per-device quota tracked in-memory (single-instance only — needs DB-backed counters before multi-replica deploy).
- **Auth posture**: `/push/set-plan` requires the deviceId to exist in `push_devices` (403 otherwise). Full session-based auth deferred; a `device_plans` table will move billing state out of JSONB later.
- **New endpoints**: `POST /push/set-plan {deviceId, plan}`, `POST /push/boost {deviceId, interestId}` — called via raw fetch from `lib/agents/ApiClient.ts` (no OpenAPI codegen).
- **Screens**: `app/pricing.tsx` (4-card layout, monthly/annual toggle, BEST badge on Pro); profile tab links via 구독 → 요금제.
