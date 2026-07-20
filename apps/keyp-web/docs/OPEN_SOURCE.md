# Open-source components and source decisions

KeyP composes small, replaceable interfaces. It does not copy whole repositories into the product.

## Included in the standalone web app

| Component | License / terms | Function in KeyP | Why selected |
| --- | --- | --- | --- |
| [`openai/openai-agents-js`](https://github.com/openai/openai-agents-js) | MIT | Agent runtime, hosted web-search tool, typed outputs | Official OpenAI orchestration layer with tools, tracing, and Zod support |
| [`facebook/react`](https://github.com/facebook/react) | MIT | Responsive client UI | Mature component model and existing repository compatibility |
| [`vitejs/vite`](https://github.com/vitejs/vite) | MIT | Development and production client build | Fast, small, portable web build without Expo |
| [`expressjs/express`](https://github.com/expressjs/express) | MIT | Same-origin API and static server | One Node process works locally, on Replit, and on conventional hosts |
| [`colinhacks/zod`](https://github.com/colinhacks/zod) | MIT | Client/API/agent runtime contracts | One auditable validation source across boundaries |
| [`motiondivision/motion`](https://github.com/motiondivision/motion) | MIT | Result transitions | Polished state changes without a large design framework |
| [`lucide-icons/lucide`](https://github.com/lucide-icons/lucide) | ISC | Interface iconography | Consistent, accessible SVG icons |
| [`fontsource/font-files`](https://github.com/fontsource/font-files) / Noto Sans KR | SIL OFL-1.1 | Self-hosted Korean typography | Prevents blank glyphs and removes a runtime Google Fonts request |

## Native public-data adapters

These are HTTP integrations, not vendored source code:

| Source | Function | Selection reason |
| --- | --- | --- |
| [Bluesky public API](https://docs.bsky.app/docs/api/app-bsky-feed-search-posts) | Recent public social posts | Documented public AppView endpoint and exact post URLs |
| [Hacker News Algolia API](https://hn.algolia.com/api) | Recent public technical discussions | Fast date-bounded community search with stable item metadata |
| [GDELT DOC API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) | Multilingual global news metadata | Broad geographic coverage and event recency |
| [`searxng/searxng`](https://github.com/searxng/searxng) | Optional self-hosted metasearch | Operator control and replaceable JSON search; KeyP calls it over HTTP only |

## Evaluated but not bundled

| Project | Decision |
| --- | --- |
| [`DIYgod/RSSHub`](https://github.com/DIYgod/RSSHub) | Useful operator-hosted expansion, but not required for the core demo. Its AGPL service remains external if added later. |
| [`instaloader/instaloader`](https://github.com/instaloader/instaloader) | Not used. Unauthenticated Instagram scraping is brittle, incomplete, and can conflict with platform controls. |
| [`twintproject/twint`](https://github.com/twintproject/twint) | Not used. Maintenance and X markup/policy changes make it unsuitable for a reliable judging demo. |
| [`zedeus/nitter`](https://github.com/zedeus/nitter) | Not used as a production dependency. Public instances and guest-account behavior are unstable; KeyP searches indexed public X pages instead. |
| [`cadence/bibliogram`](https://github.com/cadence/bibliogram) | Not used. The project is archived and cannot provide dependable current Instagram coverage. |
| [`unclecode/crawl4ai`](https://github.com/unclecode/crawl4ai) | Not bundled. It would add a browser/crawler runtime that duplicates the hosted research tool for this MVP. |

## Social-source meaning

X, Facebook, Instagram, TikTok, YouTube, Reddit, Threads, Mastodon, and Naver have different authentication, geographic, and usage rules. In KeyP, coverage means public content discoverable through hosted web search or an approved public endpoint. It does not mean unlimited platform API access.

KeyP never logs into a user's social account, bypasses authentication or rate limits, accesses private profiles/groups/messages, constructs guessed post URLs, or deanonymizes private people.
