# KeyP demo video — 2:35 target

The official submission must be public on YouTube, under three minutes, show the working project, and include voiceover explaining the product, Codex, and GPT-5.6. English narration avoids needing a separate English translation.

## Shot list and English voiceover

### 0:00–0:18 — Problem and product

**Screen:** KeyP landing screen, slow zoom toward the interest composer.

**Voiceover:**

> The internet does not have an information shortage. It has a signal problem. KeyP is a personal signal desk that learns one interest in natural language, searches the public web in parallel, and only delivers developments that survive evidence checks.

### 0:18–0:42 — One interest becomes six missions

**Screen:** Enter “OpenAI Agents SDK and GPT-5.6 official updates,” choose 30 days, select Live, click Run. Show the loading swarm.

**Voiceover:**

> I enter one interest instead of writing dozens of searches. A GPT-5.6 intent architect turns it into six bounded missions: official sources, breaking news, social, video, communities, and Korean sources. Six specialist scouts run at the same time, alongside public Bluesky, Hacker News, and GDELT adapters.

### 0:42–1:10 — Evidence before prose

**Screen:** Scroll to the agent topology and pause on the evidence gate and four judges.

**Voiceover:**

> KeyP separates probabilistic research from deterministic acceptance. Code removes tracking URLs and duplicates, enforces event-time freshness, blocks private-network redirects, and verifies that sources open. Then four independent GPT-5.6 judges score credibility, relevance, freshness, and novelty. Code fuses those scores with fixed weights, so the final decision is inspectable.

### 1:10–1:35 — Results

**Screen:** Show signal cards, confidence, why-it-matters text, exact source links, source plan, then a narrow mobile view.

**Voiceover:**

> The result is not another chatbot answer. It is a ranked, source-linked briefing with confidence dimensions and a reason each development matters. An editor can improve the Korean or English writing, but it cannot change IDs or source URLs. Empty results are allowed; silence is better than a fabricated alert.

### 1:35–2:08 — How Codex was used

**Screen:** Briefly show the `apps/keyp-web` file tree, tests passing, architecture image, and a short Codex work-thread view if available.

**Voiceover:**

> I built this standalone web extension with Codex during Build Week. After the older Expo and Replit shell caused dependency and blank-screen failures, I made the product decision to isolate it. Codex helped inspect the boundary, scaffold the React and Express app, implement the Agents SDK swarm and safety gates, and verify desktop and mobile behavior. A real Live test exposed a Structured Outputs URL-schema incompatibility; we fixed it by moving URL validity into the deterministic security gate and reran the pipeline successfully.

### 2:08–2:28 — GPT-5.6 and open source

**Screen:** Show architecture and Open Source documentation.

**Voiceover:**

> GPT-5.6 performs the work that benefits from judgment: intent decomposition, live research, independent scoring, and multilingual editing. KeyP uses the open-source OpenAI Agents SDK and small replaceable public-data adapters instead of brittle private-platform scrapers.

### 2:28–2:35 — Close

**Screen:** Return to the KeyP result headline and logo.

**Voiceover:**

> KeyP: one interest, a swarm of specialists, and the signal before the noise.

## Recording checklist

- Use a deployed public build, not localhost, for the Live segment.
- Keep the browser at 1440×900 or 1920×1080 and zoom at 100%.
- Do one rehearsal and target 2:30–2:40, never over 3:00.
- Use no copyrighted music or unlicensed third-party marks.
- Verify every source link before recording.
- Upload as **Public**, not Unlisted, unless Devpost explicitly confirms otherwise.
