import { Router, type IRouter } from "express";
import { db, trackedInterestsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// In-memory cache so the trending endpoint can be hit on every onboarding
// session without thrashing the DB. 5-minute TTL is plenty fresh; the
// underlying signal (other users' interest topics) doesn't change second-by-
// second and we'd rather absorb a small staleness than pay N database
// scans per cold-start.
let cache: { ts: number; data: TrendingResponse } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface TrendingItem {
  /** Display label (the topic word). */
  label: string;
  /** How many interests reference this label. */
  count: number;
}

interface TrendingResponse {
  items: TrendingItem[];
  totalInterests: number;
  cachedAt: string;
}

// Words that appear in nearly every spec and add no signal — drop them so
// "관심사", "정보", "news", "alert" etc. don't dominate the chart.
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "about", "into",
  "관심사", "정보", "소식", "이슈", "트렌드", "관련", "최근",
  "news", "info", "alert", "alerts", "update", "updates",
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  const lowered = text.replace(/<[^>]+>/g, " ").toLowerCase();
  // Unicode letter/number sequences. Hangul, Latin, CJK all match.
  const matches = lowered.match(/[\p{L}\p{N}]+/gu) ?? [];
  const out: string[] = [];
  for (const m of matches) {
    if (m.length < 2) continue;
    if (STOP_WORDS.has(m)) continue;
    out.push(m);
  }
  return out;
}

router.get("/discover/trending-interests", async (req, res) => {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    res.json(cache.data);
    return;
  }
  try {
    // Pull only the signal columns we need. cap=2000 because beyond that
    // top-K saturates and you're just paying scan cost for diminishing
    // returns. Order desc so we always sample the freshest interests.
    const rows = await db
      .select({
        spec: trackedInterestsTable.spec,
        rawText: trackedInterestsTable.rawText,
      })
      .from(trackedInterestsTable)
      .orderBy(sql`created_at DESC NULLS LAST`)
      .limit(2000);
    const counts = new Map<string, number>();
    for (const row of rows) {
      const spec = (row.spec ?? {}) as { topic?: string; entities?: string[] };
      const seenInRow = new Set<string>();
      const candidates: string[] = [];
      if (typeof spec.topic === "string") candidates.push(spec.topic);
      if (Array.isArray(spec.entities)) {
        for (const e of spec.entities) {
          if (typeof e === "string") candidates.push(e);
        }
      }
      // Each candidate can be multi-word ("강남 부동산"); keep the whole
      // phrase if it has at least one non-stopword token, since phrases are
      // more meaningful than the bag-of-words alternative.
      for (const phrase of candidates) {
        const trimmed = phrase.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (key.length < 2 || key.length > 40) continue;
        if (STOP_WORDS.has(key)) continue;
        if (seenInRow.has(key)) continue;
        seenInRow.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      // If neither topic nor entities give us anything, fall back to
      // tokenizing rawText so we at least get SOME signal from this row.
      if (seenInRow.size === 0 && row.rawText) {
        for (const tok of tokenize(row.rawText)) {
          if (seenInRow.has(tok)) continue;
          seenInRow.add(tok);
          counts.set(tok, (counts.get(tok) ?? 0) + 1);
        }
      }
    }
    const items: TrendingItem[] = [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .filter((i) => i.count >= 2) // singletons aren't "trending"
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    const data: TrendingResponse = {
      items,
      totalInterests: rows.length,
      cachedAt: new Date().toISOString(),
    };
    cache = { ts: Date.now(), data };
    res.json(data);
  } catch (err) {
    req.log.warn({ err }, "[discover] trending failed");
    // Best-effort: empty list is harmless — onboarding just doesn't show chips.
    res.json({ items: [], totalInterests: 0, cachedAt: new Date().toISOString() });
  }
});

export default router;
