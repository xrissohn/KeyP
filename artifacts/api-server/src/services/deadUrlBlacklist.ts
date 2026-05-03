import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger";

interface BlacklistEntry {
  url: string;
  host: string;
  reason: string;
  ts: number;
}

const DATA_DIR = path.resolve(process.cwd(), ".local-data");
const FILE_PATH = path.join(DATA_DIR, "dead-urls.jsonl");
const MAX_ENTRIES = 5000;

const memory = new Map<string, BlacklistEntry>();
let loaded = false;
let writeQueue: Promise<unknown> = Promise.resolve();

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_EXACT = new Set(["fbclid", "gclid"]);

const SKIP_REASONS = new Set(["status_401", "status_403", "status_429"]);

function isTransientReason(reason: string): boolean {
  if (SKIP_REASONS.has(reason)) return true;
  const lower = reason.toLowerCase();
  if (lower.includes("abort")) return true;
  if (lower.includes("timeout")) return true;
  if (lower.includes("timed out")) return true;
  return false;
}

function normalizeUrl(raw: string): { normalized: string; host: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  u.hostname = u.hostname.toLowerCase();
  if (
    (u.protocol === "http:" && u.port === "80") ||
    (u.protocol === "https:" && u.port === "443")
  ) {
    u.port = "";
  }
  u.hash = "";
  const params = u.searchParams;
  const toDelete: string[] = [];
  for (const key of params.keys()) {
    const lk = key.toLowerCase();
    if (TRACKING_PARAM_EXACT.has(lk)) toDelete.push(key);
    else if (TRACKING_PARAM_PREFIXES.some((p) => lk.startsWith(p))) toDelete.push(key);
  }
  for (const k of toDelete) params.delete(k);
  let str = u.toString();
  // Drop trailing slash on path (but not on root-only "/")
  // Use URL's pathname check: if pathname ends with "/" and path is not just "/"
  if (u.pathname.length > 1 && u.pathname.endsWith("/") && u.search === "") {
    // rebuild without trailing slash
    const noSlash = u.pathname.slice(0, -1);
    str = `${u.protocol}//${u.host}${noSlash}${u.search}`;
  } else if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    const noSlash = u.pathname.slice(0, -1);
    str = `${u.protocol}//${u.host}${noSlash}${u.search}`;
  }
  return { normalized: str, host: u.hostname };
}

function evictIfNeeded(): void {
  if (memory.size <= MAX_ENTRIES) return;
  const entries = Array.from(memory.entries()).sort((a, b) => a[1].ts - b[1].ts);
  const toRemove = memory.size - MAX_ENTRIES;
  for (let i = 0; i < toRemove; i++) {
    const e = entries[i];
    if (e) memory.delete(e[0]);
  }
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
        const obj = JSON.parse(trimmed) as Partial<BlacklistEntry>;
        if (
          typeof obj.url === "string" &&
          typeof obj.host === "string" &&
          typeof obj.reason === "string" &&
          typeof obj.ts === "number"
        ) {
          memory.set(obj.url, {
            url: obj.url,
            host: obj.host,
            reason: obj.reason,
            ts: obj.ts,
          });
          count++;
        }
      } catch {
        // skip bad line
      }
    }
    evictIfNeeded();
    logger.info({ count: memory.size, parsed: count }, "[blacklist] loaded from disk");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      logger.info({}, "[blacklist] no existing file; starting empty");
    } else {
      logger.warn({ err }, "[blacklist] failed to load from disk");
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
    logger.warn({ err }, "[blacklist] failed to ensure data dir");
  }
  await loadFromDisk();
})();

export async function isBlacklisted(url: string): Promise<boolean> {
  if (!loaded) return false;
  const n = normalizeUrl(url);
  if (!n) return false;
  return memory.has(n.normalized);
}

export async function addToBlacklist(url: string, reason: string): Promise<void> {
  if (isTransientReason(reason)) return;
  const n = normalizeUrl(url);
  if (!n) return;
  if (memory.has(n.normalized)) return;
  const entry: BlacklistEntry = {
    url: n.normalized,
    host: n.host,
    reason,
    ts: Date.now(),
  };
  memory.set(entry.url, entry);
  evictIfNeeded();
  const line = JSON.stringify(entry) + "\n";
  writeQueue = writeQueue
    .then(async () => {
      await ensureDataDir();
      await fs.appendFile(FILE_PATH, line, "utf8");
    })
    .catch((err) => {
      logger.warn({ err }, "[blacklist] failed to append entry");
    });
  await writeQueue;
}

export async function getRecentBlacklistedHosts(limit = 50): Promise<string[]> {
  if (!loaded) return [];
  const entries = Array.from(memory.values()).sort((a, b) => b.ts - a.ts);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    if (seen.has(e.host)) continue;
    seen.add(e.host);
    out.push(e.host);
    if (out.length >= limit) break;
  }
  return out;
}

export async function getRecentBlacklistedEntries(limit = 50): Promise<BlacklistEntry[]> {
  if (!loaded) return [];
  return Array.from(memory.values())
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

export function getBlacklistSize(): number {
  return memory.size;
}
