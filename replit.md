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
    - **Planner (GPT-5.4):** Acts as a detective to extract structured `InterestSpec`, infer `targetPersona`, and generate a `searchStrategy` with concrete queries and rationales.
    - **Collector (Perplexity/Sonar-Pro):** A public-content research assistant performing real web searches, following the Planner's `searchStrategy`. It's instructed to never return an empty alerts array.
    - **Verifier (Claude Sonnet 4.6):** Scores credibility and relevance of collected candidates.
    - **Deliverer:** Sorts alerts based on content recency and confidence, implementing a strict semantic deduplication mechanism using Jaccard similarity.
- **Real-time Collection:** A background polling mechanism refreshes active interests at configurable intervals, with client-side deduplication and throttling.
- **Push Notifications:** Supports native Expo push notifications and web browser notifications, with server-side polling for remote push when the app is closed. A server-side poller manages push dispatch, tracks device registrations, and updates `seen_alerts`.
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
    - **Planner:** OpenAI `gpt-5.4` (`@workspace/integrations-openai-ai-server`)
    - **Collector:** Perplexity `perplexity/sonar-pro` (via OpenRouter - `@workspace/integrations-openrouter-ai`)
    - **Verifier:** Anthropic `claude-sonnet-4-6` (`@workspace/integrations-anthropic-ai`)
- **Push Notifications:** Expo Push Service
- **Mobile Development Framework:** Expo React Native