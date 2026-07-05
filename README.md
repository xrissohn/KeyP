# KeyP

KeyP is a real-time interest alert service built as a pnpm monorepo. It includes an Expo React Native app, an Express API server, shared database/API libraries, and Vite-based presentation/mockup artifacts.

## Structure

- `artifacts/keyp`: Expo React Native mobile app
- `artifacts/api-server`: Express 5 API server with Drizzle/PostgreSQL
- `artifacts/keyp-deck`: Vite presentation deck
- `artifacts/mockup-sandbox`: Vite UI sandbox
- `lib/*`: shared DB schema, OpenAPI/Zod/client code, and AI integration clients
- `docs/`: product/specification documents
- `screenshots/`: app screenshots

## Requirements

- Node.js `>=22.12.0 <25` (Node 24 is recommended)
- pnpm `10.15.0`

```bash
corepack prepare pnpm@10.15.0 --activate
pnpm install --frozen-lockfile
```

## Common Commands

```bash
pnpm run typecheck
pnpm run build
```

If Corepack shims are not enabled locally, use `corepack pnpm ...` instead of `pnpm ...`.

## Secret Handling

Do not commit runtime secrets in `.replit`, `.env`, source files, generated bundles, or documentation. Use `.env.example` for placeholders only, and store real values in Replit Secrets, GitHub Actions secrets, or the deployment provider's environment settings.

If a VAPID key pair is ever exposed, generate a new VAPID public/private pair and replace both `VAPID_PUBLIC_KEY`/`EXPO_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in the deployment environment.

## Environment

The API server and AI pipeline require runtime environment variables:

- `PORT`
- `DATABASE_URL`
- `KEYP_AI_ENABLED=true` to enable automatic AI polling
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL`
- `AI_INTEGRATIONS_OPENROUTER_API_KEY`
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` for web push
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_PROXY_URL` for Clerk auth/proxy flows
- `ADMIN_TOKEN`, `ADMIN_EMAILS` for admin routes

The Expo app also reads public values such as `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_REPL_ID`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLERK_PROXY_URL`, and `EXPO_PUBLIC_VAPID_PUBLIC_KEY`.

## Notes

- No `.env` file, `.replit` shared env block, or hard-coded production secrets are included.
- `dist`, `static-build`, `node_modules`, Expo caches, and TypeScript build info are ignored.
- More implementation detail is available in `replit.md` and the files under `docs/`.
