# Workspace

## Overview

This project is a pnpm workspace monorepo utilizing TypeScript, designed to build a mobile application called KeyP. KeyP's primary purpose is to provide real-time interest alerts and an internal matching system with a Korean UI. The application aims to deliver personalized, timely information by leveraging advanced AI agents for content collection, verification, and delivery, focusing on a global search capability with intelligent translation. The business vision includes offering various subscription plans to cater to different user needs, from free basic usage to premium features with higher alert frequency and more interests.

## User Preferences

- I prefer simple language.
- I like functional programming.
- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `Z`.
- Do not make changes to the file `Y`.

## System Architecture

The project is built on a monorepo structure using pnpm workspaces, Node.js 24, and TypeScript 5.9. The API is powered by Express 5, with PostgreSQL and Drizzle ORM for data persistence. Zod is used for validation, and Orval generates API code from an OpenAPI specification. Bundling is handled by esbuild.

### KeyP Mobile App (Expo React Native)

- **UI/UX:** Full Korean UI throughout, with NativeTabs featuring liquid glass on iOS 26+ and a BlurView tab bar on older iOS. The color scheme for dark theme uses `#0A0E1A` for background, `#141929` for cards, `#5B7FFF` for primary actions, and `#FF6B8A` for accents. Specific source icons and colors are used (e.g., YouTube red, Twitter blue).
- **Authentication:** Mock authentication via AsyncStorage.
- **State Management:** App-wide context (`AppContext.tsx`) manages interests, alerts, matches, and language settings.
- **Internationalization:** A minimal, dependency-free i18n system supports Korean and English, with language detection and user-configurable language settings.
- **Data Persistence:** Local persistence is primarily handled via AsyncStorage.
- **AI Pipeline:**
    - **GPT-5.6 Swarm (primary):** OpenAI Agents SDK IntentRefiner and QueryDecomposer create six bounded parallel source lanes. Four GPT-5.6 judges independently score credibility, relevance, freshness, and novelty before deterministic fusion and multilingual editing.
    - **Source collection:** Six Perplexity/Sonar-Pro scouts run concurrently with public Bluesky, Hacker News, GDELT, optional SearXNG, and optional RSS adapters.
    - **Deterministic gates:** Exact-URL reachability, SSRF protection, event-time freshness, semantic deduplication, and weighted ranking stay outside model control.
    - **Legacy fallback:** The prior Planner → Collector → Claude Verifier → Deliverer path remains available when `KEYP_SWARM_MODE=off` or when primary mode cannot start.
- **Real-time Collection:** A background polling mechanism refreshes active interests at configurable intervals, with client-side deduplication and throttling.
- **Push Notifications:** Supports native Expo push notifications and real PWA Web Push (VAPID-signed via `web-push`, fired from a service worker `push` event so notifications work when every browser tab is closed — YouTube-style). A server-side poller manages push dispatch independently for both channels, tracks device + browser-subscription registrations, and updates `seen_alerts`. The PWA app-icon badge is bumped via the App Badging API both client-side (mirrors `unreadCount`) and from the SW push handler. PWA icons + manifest use the real KeyP logo at 192/512/512-maskable/1024/180/32 sizes.
- **URL Handling:** Includes a URL reachability gate, a dead-URL blacklist service, and a click-time safety net for robust external link management.
- **Feedback Personalization:** User feedback (like/dislike) is used to personalize alert selection and prompt injection for the Verifier, with a decay mechanism for weights.
- **Cost Optimization:** Features like spec-bucket caching, in-flight coalescing, and monthly "boost" quotas are implemented to manage LLM costs across different subscription plans.

### Key Features and Specifications

- **Interest Management:** Users can add, view, and manage interests, with AI-driven analysis of natural language input to create `InterestSpecs`.
- **Alert Feed:** Displays a feed of alerts, with new alerts indicated by a badge.
- **Matching:** A reciprocal match feed feature.
- **Profile:** User profile and statistics.
- **Saved Alerts:** Functionality to save alerts, with a legacy migration system for dummy bookmarks.
- **AI Agent Visualization:** The interest addition screen visualizes the step-by-step agent pipeline.
- **Strict Semantic Deduplication:** Ensures users do not receive duplicate alerts, both client-side and server-side.
- **Pricing Plans:** Free, Basic, Pro, and Power plans with varying alert frequencies, interest limits, and boost quotas.

## External Dependencies

- **Monorepo Tool:** pnpm workspaces
- **API Framework:** Express 5
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild
- **AI Integrations (via Replit AI Integrations):**
    - **Manager/Judges/Editor:** OpenAI `gpt-5.6` via `@openai/agents`, using the existing Replit OpenAI-compatible gateway
    - **Collector:** Perplexity `perplexity/sonar-pro` (via OpenRouter - `@workspace/integrations-openrouter-ai`)
    - **Verifier:** Anthropic `claude-sonnet-4-6` (`@workspace/integrations-anthropic-ai`)
- **Push Notifications:** Expo Push Service
- **Mobile Development Framework:** Expo React Native
