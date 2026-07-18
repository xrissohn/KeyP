# KeyP evaluations

`cases.jsonl` is a small deterministic regression set for source classification and semantic duplicate blocking. It is executed by `src/services/swarm/eval.test.ts` together with the core unit tests.

The live evaluation checklist is intentionally separate because it calls paid model/search integrations:

1. Set `KEYP_AI_ENABLED=true` and `KEYP_SWARM_MODE=strict` in a non-production Replit deployment.
2. Run each interest twice, passing first-run titles and summaries as `existingAlertSummaries` on the second run.
3. Record source URL reachability, event-age correctness, duplicate recurrence, judge inclusion, final language, elapsed time, and `parallelSpeedup`.
4. Manually review at least 20 outputs across Korean, English, local, news, video, and community interests.

Recommended acceptance targets for the demo build:

- 100% of returned source URLs open or are intentionally access-gated with a real page.
- 0 repeated stories on the immediate second request.
- 0 candidates older than the supplied event freshness floor.
- All six source lanes and all four judge agents visible in `steps`.
- Final text is in the requested UI language while the original URL remains unchanged.
