---
name: KeyP codebase maturity vs pasted plans
description: The KeyP app is far more complete than roadmap/session plans suggest; audit before building.
---

# KeyP is much more built-out than pasted plans imply

**Rule:** Before implementing any pasted roadmap/session plan for KeyP, audit the
current codebase first (explore subagent). Plans here frequently describe work
that is ALREADY implemented.

**Why:** A 13-task roadmap (empty states, foreground auto-polling, trending
discovery, per-device daily rate-limit quota, beta feedback channel, A/B
experiment infra, verifier admin stats, alert clustering, source block/boost,
legal pages, share sheet, onboarding value prop) was handed over as if pending —
but every item already existed in code. Blindly implementing would have
duplicated/clobbered working features.

**How to apply:** Map plan paths to real ones (mobile state is
`artifacts/keyp/context/AppContext.tsx`, not lib/; i18n at
`artifacts/keyp/lib/i18n.ts`; API routes/services already include discover,
feedback, experiments, rateLimit; DB schemas already include usageQuota,
sourcePreferences, userReports). Then verify each task DONE/PARTIAL/MISSING and
only fill genuine gaps.

**Note:** Alert "clustering" is implemented as a `duplicateSources` array on the
alert (server groups by URL host; AlertCard shows a "+N other sources" pill),
NOT a flat `cluster`/cluster-id field. If a plan asks for a cluster field,
confirm with the user whether the existing approach suffices before refactoring.
