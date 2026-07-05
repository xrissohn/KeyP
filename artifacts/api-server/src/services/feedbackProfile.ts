import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger";

export type FeedbackKind = "like" | "dislike" | "more" | "hide";

export interface FeedbackEntry {
  deviceId: string;
  alertId: string;
  interestId?: string;
  title: string;
  summary: string;
  sourceType?: string;
  sourceName?: string;
  tags?: string[];
  feedback: FeedbackKind;
  ts: number;
}

export interface DeviceProfile {
  tokenWeights: Map<string, number>;
  sourceWeights: Map<string, number>;
  tagWeights: Map<string, number>;
  recentLikes: { title: string; summary: string }[];
  recentDislikes: { title: string; summary: string }[];
  eventCount: number;
}

const DATA_DIR = path.resolve(process.cwd(), ".local-data");
const FILE_PATH = path.join(DATA_DIR, "feedback.jsonl");
const HALF_LIFE_DAYS = 14;
const MAX_TOKENS_PER_ITEM = 8;
const MAX_RECENT_EXAMPLES = 5;
const TRIM_LEN = 200;

const VALID_FEEDBACK = new Set<FeedbackKind>(["like", "dislike", "more", "hide"]);
const FEEDBACK_BASE_WEIGHT: Record<FeedbackKind, number> = {
  like: 2,
  more: 3,
  dislike: -3,
  hide: -2,
};

const entriesByDevice = new Map<string, FeedbackEntry[]>();
const profileCache = new Map<string, DeviceProfile>();
let loaded = false;
let writeQueue: Promise<unknown> = Promise.resolve();

function emptyProfile(): DeviceProfile {
  return {
    tokenWeights: new Map(),
    sourceWeights: new Map(),
    tagWeights: new Map(),
    recentLikes: [],
    recentDislikes: [],
    eventCount: 0,
  };
}

function tokenize(text: string): string[] {
  if (!text) return [];
  // Strip HTML tags then lowercase
  const stripped = text.replace(/<[^>]+>/g, " ").toLowerCase();
  // Match Unicode word-like sequences (handles Korean Hangul + Latin + digits).
  const matches = stripped.match(/[\p{L}\p{N}]+/gu);
  if (!matches) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (m.length < 2) continue;
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
    if (out.length >= MAX_TOKENS_PER_ITEM) break;
  }
  return out;
}

function decayMultiplier(ageMs: number): number {
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

function trimText(s: string): string {
  if (!s) return "";
  return s.length > TRIM_LEN ? s.slice(0, TRIM_LEN) : s;
}

function buildProfile(deviceId: string): DeviceProfile {
  const entries = entriesByDevice.get(deviceId);
  if (!entries || entries.length === 0) return emptyProfile();
  const profile = emptyProfile();
  profile.eventCount = entries.length;
  const now = Date.now();

  const likeExamples: { ts: number; title: string; summary: string }[] = [];
  const dislikeExamples: { ts: number; title: string; summary: string }[] = [];

  for (const e of entries) {
    const base = FEEDBACK_BASE_WEIGHT[e.feedback];
    const w = base * decayMultiplier(Math.max(0, now - e.ts));
    const tokens = tokenize(`${e.title} ${e.summary}`);
    for (const t of tokens) {
      profile.tokenWeights.set(t, (profile.tokenWeights.get(t) ?? 0) + w);
    }
    if (e.sourceType) {
      profile.sourceWeights.set(
        e.sourceType,
        (profile.sourceWeights.get(e.sourceType) ?? 0) + w,
      );
    }
    if (e.sourceName) {
      const key = `name:${e.sourceName}`;
      profile.sourceWeights.set(key, (profile.sourceWeights.get(key) ?? 0) + w);
    }
    if (Array.isArray(e.tags)) {
      for (const tag of e.tags) {
        if (!tag) continue;
        profile.tagWeights.set(tag, (profile.tagWeights.get(tag) ?? 0) + w);
      }
    }
    if (e.feedback === "like" || e.feedback === "more") {
      likeExamples.push({ ts: e.ts, title: trimText(e.title), summary: trimText(e.summary) });
    } else if (e.feedback === "dislike" || e.feedback === "hide") {
      dislikeExamples.push({ ts: e.ts, title: trimText(e.title), summary: trimText(e.summary) });
    }
  }

  likeExamples.sort((a, b) => b.ts - a.ts);
  dislikeExamples.sort((a, b) => b.ts - a.ts);
  profile.recentLikes = likeExamples.slice(0, MAX_RECENT_EXAMPLES).map((x) => ({
    title: x.title,
    summary: x.summary,
  }));
  profile.recentDislikes = dislikeExamples.slice(0, MAX_RECENT_EXAMPLES).map((x) => ({
    title: x.title,
    summary: x.summary,
  }));
  return profile;
}

function invalidateProfile(deviceId: string): void {
  profileCache.delete(deviceId);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadFromDisk(): Promise<void> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    const lines = raw.split("\n");
    let count = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as Partial<FeedbackEntry>;
        if (
          typeof obj.deviceId === "string" &&
          obj.deviceId.length > 0 &&
          typeof obj.alertId === "string" &&
          typeof obj.title === "string" &&
          typeof obj.summary === "string" &&
          typeof obj.feedback === "string" &&
          VALID_FEEDBACK.has(obj.feedback as FeedbackKind) &&
          typeof obj.ts === "number"
        ) {
          const entry: FeedbackEntry = {
            deviceId: obj.deviceId,
            alertId: obj.alertId,
            interestId: typeof obj.interestId === "string" ? obj.interestId : undefined,
            title: obj.title,
            summary: obj.summary,
            sourceType: typeof obj.sourceType === "string" ? obj.sourceType : undefined,
            sourceName: typeof obj.sourceName === "string" ? obj.sourceName : undefined,
            tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 12) : undefined,
            feedback: obj.feedback as FeedbackKind,
            ts: obj.ts,
          };
          const list = entriesByDevice.get(entry.deviceId) ?? [];
          list.push(entry);
          entriesByDevice.set(entry.deviceId, list);
          count++;
        }
      } catch {
        // skip bad line
      }
    }
    logger.info(
      { devices: entriesByDevice.size, entries: count },
      "[feedback] loaded from disk",
    );
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      logger.info({}, "[feedback] no existing file; starting empty");
    } else {
      logger.warn({ err }, "[feedback] failed to load from disk");
    }
  } finally {
    loaded = true;
  }
}

// Kick off load asynchronously; don't block the caller.
void (async () => {
  try {
    await ensureDataDir();
  } catch (err) {
    logger.warn({ err }, "[feedback] failed to ensure data dir");
  }
  await loadFromDisk();
})();

export async function recordFeedback(entry: FeedbackEntry): Promise<void> {
  if (!entry.deviceId || !entry.feedback || !VALID_FEEDBACK.has(entry.feedback)) return;
  const normalized: FeedbackEntry = {
    deviceId: entry.deviceId,
    alertId: entry.alertId,
    interestId: entry.interestId,
    title: entry.title ?? "",
    summary: entry.summary ?? "",
    sourceType: entry.sourceType,
    sourceName: entry.sourceName,
    tags: entry.tags,
    feedback: entry.feedback,
    ts: typeof entry.ts === "number" && entry.ts > 0 ? entry.ts : Date.now(),
  };
  const list = entriesByDevice.get(normalized.deviceId) ?? [];
  list.push(normalized);
  entriesByDevice.set(normalized.deviceId, list);
  invalidateProfile(normalized.deviceId);
  const line = JSON.stringify(normalized) + "\n";
  writeQueue = writeQueue
    .then(async () => {
      await ensureDataDir();
      await fs.appendFile(FILE_PATH, line, "utf8");
    })
    .catch((err) => {
      logger.warn({ err }, "[feedback] failed to append entry");
    });
  await writeQueue;
}

export async function getProfile(deviceId: string): Promise<DeviceProfile> {
  if (!deviceId || !loaded) return emptyProfile();
  const cached = profileCache.get(deviceId);
  if (cached) return cached;
  const profile = buildProfile(deviceId);
  profileCache.set(deviceId, profile);
  return profile;
}

export function scoreCandidate(
  profile: DeviceProfile,
  c: {
    title: string;
    summary: string;
    sourceType?: string;
    sourceName?: string;
    tags?: string[];
  },
): number {
  if (profile.eventCount === 0) return 0;
  let score = 0;
  const tokens = tokenize(`${c.title ?? ""} ${c.summary ?? ""}`);
  for (const t of tokens) {
    const w = profile.tokenWeights.get(t);
    if (w) score += w;
  }
  if (c.sourceType) {
    const w = profile.sourceWeights.get(c.sourceType);
    if (w) score += w;
  }
  if (c.sourceName) {
    const w = profile.sourceWeights.get(`name:${c.sourceName}`);
    if (w) score += w;
  }
  if (Array.isArray(c.tags)) {
    for (const tag of c.tags) {
      if (!tag) continue;
      const w = profile.tagWeights.get(tag);
      if (w) score += w;
    }
  }
  return score;
}

export function topTokens(profile: DeviceProfile, n = 8, ascending = false): string[] {
  const arr = Array.from(profile.tokenWeights.entries());
  arr.sort((a, b) => (ascending ? a[1] - b[1] : b[1] - a[1]));
  const filtered = arr.filter(([, w]) => (ascending ? w < 0 : w > 0));
  return filtered.slice(0, n).map(([k]) => k);
}

export function isProfileEmpty(profile: DeviceProfile): boolean {
  return profile.eventCount === 0;
}
