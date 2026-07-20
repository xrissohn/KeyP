# OpenAI Build Week submission checklist

Official deadline: **July 21, 2026 at 5:00 PM Pacific Time**. Verify the final details against the [official rules](https://openai.devpost.com/rules).

## Ready in this repository

- [x] Working standalone project built with Codex and GPT-5.6
- [x] Track selected: **Apps for Your Life**
- [x] Pre-existing work and post-July-13 extension clearly separated
- [x] Public-repository-ready MIT license and third-party attribution
- [x] Setup, sample Demo mode, testing, architecture, safety, and deployment instructions
- [x] Codex collaboration and key human decisions documented
- [x] GPT-5.6 runtime roles documented and visible in the UI
- [x] Desktop and mobile screenshots
- [x] Under-three-minute English video script with voiceover plan

## Still required before clicking Submit

- [ ] Push `keyp-web-rebuild` (or merge it) to the judging repository
- [ ] Deploy a free public working URL and repeat one Live URL-gate test there
- [ ] Record the working UI and create a **public YouTube video under 3 minutes**
- [ ] Include voiceover covering the product, Codex workflow, and GPT-5.6 runtime integration
- [ ] Edit the description draft into the entrant's own voice; do not submit AI text unchanged
- [ ] Run `/feedback` in the primary Codex build thread and paste that Session ID
- [ ] Add the repository URL, deployed URL, YouTube URL, and English testing instructions to Devpost
- [ ] If the repository is private, share it with `testing@devpost.com` and `build-week-event@openai.com`
- [ ] Confirm the app remains free and available through the judging period

## Suggested description outline — rewrite in your own voice

1. **Problem:** following an interest across fragmented public sources creates noise, repetition, and missed early signals.
2. **Product:** KeyP turns one sentence into a six-lane monitoring plan and returns only source-linked signals that pass independent freshness, credibility, relevance, and novelty checks.
3. **Technical distinction:** probabilistic agents search and judge; deterministic code controls URL safety, deduplication, hard gates, and final weighting.
4. **Codex collaboration:** explain the decision to isolate the unstable Expo/Replit shell, create a clean portable web app, implement and test the swarm, and catch the real Structured Outputs issue through Live testing.
5. **Impact:** a personal signal desk for launches, research, careers, policy, communities, hobbies, and any evolving interest.
