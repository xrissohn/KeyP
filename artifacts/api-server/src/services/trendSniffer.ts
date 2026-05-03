// ============================================================
// Trend Sniffer — data-backed channel prioritization.
//
// The Planner agent (GPT) produces a `searchStrategy` ordered by its
// internal guess of which platforms are most likely to surface the
// user's interest first. That guess is a frozen-in-training prior; it
// has no idea where the topic is *actually* hot RIGHT NOW.
//
// Trend Sniffer fixes that by querying TWO live signals before we burn
// Collector tokens:
//
//   (A) Google Trends (free, unofficial `google-trends-api` package)
//       → relatedQueries + interestByRegion. Tells us what people are
//         ACTUALLY searching for around this topic in the last day, and
//         in which regions/cities the topic spikes.
//
//   (C) Perplexity meta-search (uses our existing OpenRouter key)
//       → asks Sonar Pro to enumerate the top platforms / communities /
//         handles / hashtags / subreddits where this exact topic is
//         being discussed in the last 24-72 hours, with brief evidence.
//
// We then MERGE both signals into the Planner's existing strategy:
//   1. Boost any planner channel whose name/query overlaps a hot keyword
//   2. Append up to N net-new channels surfaced by signals
//   3. Cap to MAX_STRATEGY_ENTRIES, preserving the merged ranking.
//
// Cached per (topic, entities, location) for 6h to avoid hammering both
// services from the poller cron.
// ============================================================

import googleTrends from "google-trends-api";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import type { Logger } from "pino";

export interface StrategyEntry {
  channel: string;
  query: string;
  rationale: string;
}

export interface SnifferEvidence {
  source: "google-trends" | "perplexity-meta";
  hotKeywords: string[];
  hotChannels: string[];
  rawSnippet?: string;
  ok: boolean;
  errorMessage?: string;
}

export interface SniffedStrategy {
  reordered: StrategyEntry[];
  bumpedChannels: string[];
  addedChannels: StrategyEntry[];
  evidence: SnifferEvidence[];
  durationMs: number;
  cached: boolean;
}

export interface SniffInput {
  topic: string;
  entities: string[];
  locationScope?: string | null;
  plannerStrategy: StrategyEntry[];
  logger?: Logger;
}

const MAX_STRATEGY_ENTRIES = 8;
const MAX_NEW_CHANNELS_FROM_SNIFFER = 3;
const CACHE_TTL_MS = 6 * 60 * 60_000;
const SIGNAL_TIMEOUT_MS = 8_000;
const MAX_CACHE_ENTRIES = 500;

// We cache the RAW EVIDENCE only — never the merged strategy. Why: the
// merged result is a function of (evidence × plannerStrategy), and two
// requests with the same topic but slightly different Planner outputs
// (e.g. user edited interest text) must NOT share a merged result. The
// evidence (what Google says is hot, what Perplexity says is hot) only
// depends on (topic, entities, location), so it's safely shareable.
//
// Re-merging per-request is sub-millisecond — there's no perf cost.
interface CachedEvidence {
  evidence: SnifferEvidence[];
  expiresAt: number;
  durationMs: number;
}
const evidenceCache = new Map<string, CachedEvidence>();
// Singleflight: dedupe concurrent misses for the same key so we never
// pay 2× Google + 2× Perplexity tokens for the same topic at TTL boundary.
const inFlight = new Map<string, Promise<CachedEvidence>>();

function cacheKey(topic: string, entities: string[], location?: string | null): string {
  return `${topic.trim().toLowerCase()}::${[...entities]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .slice(0, 4)
    .join(",")}::${(location ?? "").trim().toLowerCase()}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// ─── Signal A: Google Trends (free, unofficial) ───────────────────────
//
// We use BOTH `relatedQueries` (top + rising) and `interestByRegion`.
// Rising queries are the most useful signal for "what's hot RIGHT NOW
// around this topic" — Google literally exposes the % surge for each.
//
// The package is flaky (Google rate-limits aggressively, returns 429
// HTML masquerading as a 200, etc.). Wrap everything in try/catch and
// degrade silently — Perplexity meta is a strong enough fallback alone.
async function sniffGoogleTrends(
  topic: string,
  entities: string[],
  locationScope?: string | null,
  logger?: Logger,
): Promise<SnifferEvidence> {
  const evidence: SnifferEvidence = {
    source: "google-trends",
    hotKeywords: [],
    hotChannels: [],
    ok: false,
  };

  // Google Trends `geo` wants ISO country (US, KR) or country-region
  // (US-NY). Heuristic: if locationScope contains common Korean names
  // assume KR; otherwise default global ("").
  const geo = inferGeo(locationScope);
  // Use the topic itself as the seed; entities give us a fallback if
  // the topic is too long/exotic for Google's matcher.
  const seed = pickSeed(topic, entities);

  try {
    const raw = await withTimeout(
      googleTrends.relatedQueries({ keyword: seed, geo, hl: geo === "KR" ? "ko" : "en-US" }),
      SIGNAL_TIMEOUT_MS,
      "google-trends.relatedQueries",
    );
    // Package returns a string. Sometimes 429 returns HTML instead of JSON.
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) {
      throw new Error(
        `non-JSON response (likely Google rate-limit / HTML page, ${trimmed.length} bytes)`,
      );
    }
    const parsed = JSON.parse(trimmed) as {
      default?: {
        rankedList?: Array<{
          rankedKeyword?: Array<{ query?: string; topic?: { title?: string } }>;
        }>;
      };
    };
    const lists = parsed.default?.rankedList ?? [];
    const keywords = new Set<string>();
    for (const list of lists) {
      for (const item of list.rankedKeyword ?? []) {
        const q = item.query ?? item.topic?.title;
        if (q && q.length > 0 && q.length < 80) keywords.add(q.toLowerCase());
      }
    }
    evidence.hotKeywords = [...keywords].slice(0, 12);
    // ok ONLY when we actually have signal — empty payload is not a
    // success. This prevents the parse-interest step from reporting
    // "success" when in reality the signal contributed nothing.
    evidence.ok = evidence.hotKeywords.length > 0;
    evidence.rawSnippet = `relatedQueries(${seed}, geo=${geo || "WW"}) → ${evidence.hotKeywords.length} keywords`;
  } catch (err) {
    evidence.errorMessage =
      err instanceof Error ? err.message : "unknown google-trends error";
    if (logger) {
      logger.warn(
        { err: evidence.errorMessage, seed, geo },
        "[trend-sniffer] google-trends failed (degrading silently)",
      );
    }
  }

  return evidence;
}

function inferGeo(locationScope?: string | null): string {
  if (!locationScope) return "";
  const s = locationScope.toLowerCase();
  // Fast Korean-context detection — anything explicitly Korean → KR.
  if (
    /seoul|busan|incheon|korea|한국|서울|부산|인천|대구|광주|대전|울산|제주/.test(s)
  ) {
    return "KR";
  }
  if (/new york|nyc|los angeles|la|chicago|usa|united states|미국|뉴욕|la 한인/.test(s)) {
    return "US";
  }
  if (/tokyo|osaka|japan|일본|도쿄|오사카/.test(s)) return "JP";
  if (/london|uk|britain|영국|런던/.test(s)) return "GB";
  return "";
}

function pickSeed(topic: string, entities: string[]): string {
  // Google's matcher works best with 1-3 word seeds. Fall back to the
  // first short entity when topic is long/sentence-y.
  const t = topic.trim();
  if (t.length > 0 && t.length <= 40 && t.split(/\s+/).length <= 3) return t;
  const e = entities.find((x) => x && x.length > 0 && x.length <= 40);
  return e ?? t.slice(0, 40);
}

// ─── Signal C: Perplexity meta-search ─────────────────────────────────
//
// One short Sonar call asking "where is this topic ACTUALLY hot RIGHT
// NOW with evidence". JSON-formatted output. We keep the prompt tight
// to minimize tokens — this runs on every parse-interest call.
async function sniffPerplexityMeta(
  topic: string,
  entities: string[],
  locationScope?: string | null,
  logger?: Logger,
): Promise<SnifferEvidence> {
  const evidence: SnifferEvidence = {
    source: "perplexity-meta",
    hotKeywords: [],
    hotChannels: [],
    ok: false,
  };

  const userBlock = `Topic: ${topic}
Entities: ${entities.slice(0, 5).join(", ") || "(none)"}
Location: ${locationScope ?? "(no location restriction — global)"}

In the last 24-72 hours, where is THIS specific topic ACTUALLY being discussed the most online? List the top 5 most-active SPECIFIC channels (not generic "Reddit" — instead "r/koreanamerican", not "Twitter" — instead "@nyukorean OR #뉴욕한인"). For each, give one brief sentence of EVIDENCE (post count, recent thread, trending hashtag, viral video, etc.). Also list 5-8 trending KEYWORDS or sub-topics people are using to discuss it.

Respond ONLY with strict JSON:
{
  "channels": [
    {"channel": "<specific platform/community/handle/hashtag/subreddit>", "query": "<concrete search phrase to use there>", "evidence": "<one sentence of why this is hot RIGHT NOW>"}
  ],
  "trendingKeywords": ["<kw1>", "<kw2>", "..."]
}`;

  try {
    const completion = await withTimeout(
      openrouter.chat.completions.create({
        model: "perplexity/sonar",
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content:
              "You are a real-time online-discussion analyst. You search the live web and return strict JSON listing the SPECIFIC platforms/communities/handles/hashtags where a given topic is most active right now, with one sentence of evidence each. Never return generic platforms — always specific subreddits/handles/cafes/hashtags. Output JSON only.",
          },
          { role: "user", content: userBlock },
        ],
      }),
      SIGNAL_TIMEOUT_MS * 2,
      "perplexity-meta",
    );
    const raw = completion.choices[0]?.message?.content ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON object in response");
    const parsed = JSON.parse(m[0]) as {
      channels?: Array<{ channel?: string; query?: string; evidence?: string }>;
      trendingKeywords?: string[];
    };
    const channels = Array.isArray(parsed.channels) ? parsed.channels : [];
    evidence.hotChannels = channels
      .filter((c) => typeof c?.channel === "string" && c.channel.length > 0)
      .map((c) => String(c.channel))
      .slice(0, 6);
    evidence.hotKeywords = Array.isArray(parsed.trendingKeywords)
      ? parsed.trendingKeywords
          .filter((k): k is string => typeof k === "string" && k.length > 0)
          .map((k) => k.toLowerCase())
          .slice(0, 10)
      : [];
    // Stash the full parsed channels into rawSnippet so the merger can
    // use the Perplexity-supplied query+evidence when promoting them
    // into actual StrategyEntry objects.
    evidence.rawSnippet = JSON.stringify({ channels: channels.slice(0, 6) });
    // ok only when at least one of channels/keywords actually populated.
    evidence.ok =
      evidence.hotChannels.length > 0 || evidence.hotKeywords.length > 0;
  } catch (err) {
    evidence.errorMessage =
      err instanceof Error ? err.message : "unknown perplexity-meta error";
    if (logger) {
      logger.warn(
        { err: evidence.errorMessage },
        "[trend-sniffer] perplexity-meta failed (degrading silently)",
      );
    }
  }

  return evidence;
}

// ─── Merge ────────────────────────────────────────────────────────────
function mergeStrategy(
  plannerStrategy: StrategyEntry[],
  evidence: SnifferEvidence[],
): { reordered: StrategyEntry[]; bumped: string[]; added: StrategyEntry[] } {
  const allHotKeywords = new Set<string>();
  for (const ev of evidence) {
    if (!ev.ok) continue;
    for (const kw of ev.hotKeywords) allHotKeywords.add(kw.toLowerCase());
    for (const ch of ev.hotChannels) allHotKeywords.add(ch.toLowerCase());
  }

  // Score each planner entry by how many hot keywords overlap its
  // channel + query + rationale text. Score is used ONLY as a binary
  // "is corroborated?" flag — we never sort by magnitude (that would
  // disrupt Planner's relative ranking among corroborated items, which
  // encodes intent the sniffer doesn't see).
  const scored = plannerStrategy.map((entry, originalIdx) => {
    const hay = `${entry.channel} ${entry.query} ${entry.rationale}`.toLowerCase();
    let score = 0;
    for (const kw of allHotKeywords) {
      if (kw.length < 2) continue;
      if (hay.includes(kw)) score += 1;
    }
    return { entry, originalIdx, score };
  });

  // STRICT stable bump: corroborated items (score>0) move ahead of
  // uncorroborated ones, but within each group the original Planner
  // order is preserved exactly. We never reshuffle by magnitude.
  scored.sort((a, b) => {
    const aBumped = a.score > 0 ? 1 : 0;
    const bBumped = b.score > 0 ? 1 : 0;
    if (aBumped !== bBumped) return bBumped - aBumped;
    return a.originalIdx - b.originalIdx;
  });
  const bumped = scored
    .filter((s) => s.score > 0)
    .map((s) => s.entry.channel);

  // Build added[] from perplexity-meta channels not already present.
  const existingChannelKeys = new Set(
    plannerStrategy.map((e) => normalize(e.channel)),
  );
  const added: StrategyEntry[] = [];
  for (const ev of evidence) {
    if (!ev.ok || ev.source !== "perplexity-meta" || !ev.rawSnippet) continue;
    let parsed: { channels?: Array<{ channel?: string; query?: string; evidence?: string }> };
    try {
      parsed = JSON.parse(ev.rawSnippet);
    } catch {
      continue;
    }
    for (const c of parsed.channels ?? []) {
      if (added.length >= MAX_NEW_CHANNELS_FROM_SNIFFER) break;
      const channel = (c.channel ?? "").toString().slice(0, 120);
      if (!channel) continue;
      const key = normalize(channel);
      if (existingChannelKeys.has(key)) continue;
      existingChannelKeys.add(key);
      added.push({
        channel,
        query: (c.query ?? channel).toString().slice(0, 200),
        rationale:
          `[Trend Sniffer 데이터 기반] ${(c.evidence ?? "최근 실시간 활성도 높음").toString().slice(0, 180)}`,
      });
    }
  }

  // Reserve slots for added[] FIRST so they aren't silently truncated
  // when planner already produced 8 (or all) entries are corroborated.
  // Layout, capped at MAX_STRATEGY_ENTRIES:
  //   [bumped planner items, capped] + [added perplexity items] + [remaining planner]
  //
  // Critical: when bumped.length >= MAX, naive concatenation would slice
  // away the entire added[] block. So we explicitly cap bumped entries
  // to (MAX - added.length) to guarantee added items always fit.
  const sortedEntries = scored.map((s) => s.entry);
  const bumpedEntries = sortedEntries.slice(0, bumped.length);
  const restEntries = sortedEntries.slice(bumped.length);
  const maxBumpedSlots = Math.max(0, MAX_STRATEGY_ENTRIES - added.length);
  const cappedBumped = bumpedEntries.slice(0, maxBumpedSlots);
  const remainingSlots = Math.max(
    0,
    MAX_STRATEGY_ENTRIES - cappedBumped.length - added.length,
  );
  const reordered = [
    ...cappedBumped,
    ...added,
    ...restEntries.slice(0, remainingSlots),
  ].slice(0, MAX_STRATEGY_ENTRIES);
  return { reordered, bumped, added };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_\-/]+/g, "")
    .replace(/[^\p{L}\p{N}@#]/gu, "");
}

// ─── Evidence fetch with singleflight + bounded cache ─────────────────
async function fetchEvidence(
  topic: string,
  entities: string[],
  locationScope: string | null | undefined,
  logger?: Logger,
): Promise<{ evidence: SnifferEvidence[]; durationMs: number; cached: boolean }> {
  const key = cacheKey(topic, entities, locationScope);
  const now = Date.now();
  const cachedHit = evidenceCache.get(key);
  if (cachedHit && cachedHit.expiresAt > now) {
    return { evidence: cachedHit.evidence, durationMs: cachedHit.durationMs, cached: true };
  }

  // Singleflight: any concurrent caller for the same key joins the
  // in-flight promise instead of issuing fresh upstream calls.
  const inFlightHit = inFlight.get(key);
  if (inFlightHit) {
    const r = await inFlightHit;
    return { evidence: r.evidence, durationMs: r.durationMs, cached: true };
  }

  const work = (async (): Promise<CachedEvidence> => {
    const t0 = Date.now();
    // Run both signals in parallel — independent, allSettled-style
    // (sniff* functions never throw; they return ok:false on failure).
    const [trendsEv, perpEv] = await Promise.all([
      sniffGoogleTrends(topic, entities, locationScope, logger),
      sniffPerplexityMeta(topic, entities, locationScope, logger),
    ]);
    const result: CachedEvidence = {
      evidence: [trendsEv, perpEv],
      expiresAt: Date.now() + CACHE_TTL_MS,
      durationMs: Date.now() - t0,
    };
    // Bounded eviction: when over cap, drop oldest insertion. Map
    // iterates in insertion order, so the first key is the oldest.
    if (evidenceCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = evidenceCache.keys().next().value;
      if (oldest !== undefined) evidenceCache.delete(oldest);
    }
    evidenceCache.set(key, result);
    return result;
  })();

  inFlight.set(key, work);
  try {
    const r = await work;
    return { evidence: r.evidence, durationMs: r.durationMs, cached: false };
  } finally {
    inFlight.delete(key);
  }
}

// ─── Public API ───────────────────────────────────────────────────────
export async function sniffTrends(input: SniffInput): Promise<SniffedStrategy> {
  const { evidence, durationMs, cached } = await fetchEvidence(
    input.topic,
    input.entities,
    input.locationScope,
    input.logger,
  );
  // Always re-merge per-request with THIS request's plannerStrategy.
  // Evidence is shareable across requests; merged strategy is NOT,
  // because it depends on the caller's planner output.
  const { reordered, bumped, added } = mergeStrategy(input.plannerStrategy, evidence);

  return {
    reordered: reordered.length > 0 ? reordered : input.plannerStrategy,
    bumpedChannels: bumped,
    addedChannels: added,
    // Defensive copy so downstream mutation can't corrupt the cache.
    evidence: evidence.map((e) => ({ ...e })),
    durationMs: cached ? 0 : durationMs,
    cached,
  };
}

// Test/observability hook
export function _peekCacheSize(): number {
  return evidenceCache.size;
}
export function _peekInFlightSize(): number {
  return inFlight.size;
}
