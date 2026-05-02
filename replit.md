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
- **Mock Pipeline**:
  - `lib/agents/PlannerAgent.ts` — keyword-based NL → InterestSpec parser
  - `lib/agents/MockPipeline.ts` — alert generation (setTimeout-based simulation)
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
- All persistence via AsyncStorage (no backend required)
- Mock pipeline simulates 1.5–2.5s AI processing with setTimeout
- NativeTabs with liquid glass on iOS 26+, BlurView tab bar on older iOS
- Full Korean UI throughout
- Interest add screen shows step-by-step agent pipeline visualization
