# Deployment and Replit migration

## Local or generic Node host

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build:web
corepack pnpm start:web
```

Set `OPENAI_API_KEY` only in the host's server-side secret manager. The server listens on `PORT` and serves the frontend and API together.

## Replit

This standalone app does **not** use the legacy Replit AI integration variables. Register the new key in **Secrets**, not Configurations:

```text
OPENAI_API_KEY = <new key>
KEYP_MODEL = gpt-5.6
```

Optional Secrets/Configurations:

```text
KEYP_LIVE_RUN_LIMIT = 6
SEARXNG_BASE_URL = https://your-approved-searxng.example
```

Use these commands:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build:web
corepack pnpm start:web
```

If importing the whole repository into the existing Repl, change the Replit Run command to `corepack pnpm start:web` after building. Do not run the old Expo workflow for this app. A cleaner option is a new Replit Node app connected to the GitHub branch, with the repository root as its working directory.

Before judging, verify:

1. `/api/health` returns `"liveReady": true`.
2. Demo mode produces three cards without spending credits.
3. Live mode produces at least one source link and every delivered link opens.
4. The secret never appears in browser source, logs, screenshots, or Git history.
5. The public deployment remains free and unrestricted through the judging period.

## Important portability note

`.env.local` is for local development only. Replit, Vercel, Render, Fly.io, and other hosts should inject variables through their secret manager. Never copy `.env.local` into a deployment artifact.
