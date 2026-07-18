# Open-source components and integration decisions

KeyP composes small, auditable interfaces instead of copying entire third-party codebases. This reduces maintenance risk, keeps licenses clear, and lets operators replace any search provider.

| Project / API             | License or terms  | How KeyP uses it                                    | Included in repository? |
| ------------------------- | ----------------- | --------------------------------------------------- | ----------------------- |
| `openai/openai-agents-js` | MIT               | Runtime for GPT-5.6 specialist agents               | npm dependency          |
| `searxng/searxng`         | AGPL-3.0          | Optional operator-hosted JSON search endpoint       | HTTP adapter only       |
| `DIYgod/RSSHub`           | MIT               | Optional operator-hosted feeds through standard RSS | HTTP/RSS adapter only   |
| `rss-parser`              | MIT               | Normalizes RSS/Atom feeds                           | npm dependency          |
| Bluesky public API        | Bluesky API terms | Searches public posts                               | Native adapter          |
| Hacker News Algolia API   | Service/API terms | Searches recent public HN stories                   | Native adapter          |
| GDELT DOC API             | GDELT terms       | Searches recent global news metadata                | Native adapter          |

Repositories evaluated but not bundled include `unclecode/crawl4ai`, `dgtlmoon/changedetection.io`, `jdepoix/youtube-transcript-api`, `vercel/ai`, and `TanStack/ai`. They are useful building blocks, but adding them to the submission would duplicate existing extraction, monitoring, or model-runtime responsibilities without improving the core demo.

## Social platform policy

X, Facebook, YouTube, Reddit, Instagram, TikTok, Threads, Naver, and other services have different APIs, authentication requirements, geographic availability, and terms. KeyP does not present one brittle scraper as universal access. The bounded web-research scouts search content already public and indexed on the open web. Optional first-party adapters can be added when an operator supplies an approved platform credential.

KeyP never:

- logs into a user's social account;
- bypasses authentication or rate limits;
- accesses private profiles, groups, messages, or friend graphs;
- constructs guessed post URLs;
- identifies or deanonymizes private people.

Operators are responsible for complying with the terms of every configured service and for retaining third-party attribution notices when redistributing dependencies.
