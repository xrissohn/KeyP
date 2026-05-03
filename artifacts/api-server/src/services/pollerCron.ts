import { and, eq, lt, isNull, or, inArray, desc, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  db,
  trackedInterestsTable,
  seenAlertsTable,
  pushDevicesTable,
} from "@workspace/db";
import type { GeneratedAlertsResult, InterestSpecData, AlertData } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendExpoPush, type ExpoPushMessage } from "./expoPush";

// ────────────────────────────────────────────────────────────────────────
// Plan-aware polling cadence.
//
// Each tracked interest carries a `plan` field embedded in its spec JSON
// (free|basic|pro|power). Plan determines how aggressively we re-collect.
// We keep a single tick that scans rows every 60s, but each row only sweeps
// when its own plan-specific interval has elapsed — this lets free users
// (1h) and power users (5min) coexist without separate timers.
//
// Defaults are tuned for cost: 15-min Basic floor keeps OpenRouter spend
// linear with active users instead of explosive.
// ────────────────────────────────────────────────────────────────────────

export type PlanTier = "free" | "basic" | "pro" | "power";

const PLAN_INTERVAL_MS: Record<PlanTier, number> = {
  free: 60 * 60 * 1000,
  basic: 15 * 60 * 1000,
  pro: 10 * 60 * 1000,
  power: 5 * 60 * 1000,
};

const PLAN_INTEREST_CAP: Record<PlanTier, number> = {
  free: 1,
  basic: 5,
  pro: 15,
  power: 30,
};

const PLAN_BOOST_QUOTA: Record<PlanTier, number> = {
  free: 0,
  basic: 0,
  pro: 5,
  power: 30,
};

export function planIntervalMs(plan: PlanTier | string | undefined | null): number {
  const p = (plan as PlanTier) ?? "basic";
  return PLAN_INTERVAL_MS[p] ?? PLAN_INTERVAL_MS.basic;
}
export function planInterestCap(plan: PlanTier | string | undefined | null): number {
  const p = (plan as PlanTier) ?? "basic";
  return PLAN_INTEREST_CAP[p] ?? PLAN_INTEREST_CAP.basic;
}
export function planBoostQuota(plan: PlanTier | string | undefined | null): number {
  const p = (plan as PlanTier) ?? "basic";
  return PLAN_BOOST_QUOTA[p] ?? 0;
}

// Tick frequency: how often we LOOK for due rows. The actual per-row sweep
// rate is throttled by the plan interval above.
const TICK_INTERVAL_MS = Number(process.env["KEYP_POLL_TICK_MS"]) || 60 * 1000;
// Soft floor so the tick query has a sane prefilter (cheaper than scanning
// every row). Whatever the smallest plan interval is.
const SCAN_FLOOR_MS = Math.min(...Object.values(PLAN_INTERVAL_MS));
const MAX_INTERESTS_PER_TICK = Number(process.env["KEYP_POLL_BATCH"]) || 20;

// ────────────────────────────────────────────────────────────────────────
// Spec-bucket cache (the headline cost-optimizer).
//
// Every Collector+Verifier round-trip is ~$0.08. When 100 users all track
// "강남 부동산" we used to pay $8 per cycle. By keying on a stable hash of
// the spec topic+entities+location, the FIRST sweep within the TTL window
// pays the API call; every subsequent interest with the same bucket reuses
// the result for free. This is the dominant lever for unit economics.
// ────────────────────────────────────────────────────────────────────────

const BUCKET_TTL_MS = Number(process.env["KEYP_BUCKET_TTL_MS"]) || 5 * 60 * 1000;

interface BucketEntry {
  result: GeneratedAlertsResult;
  storedAt: number;
}
const bucketCache = new Map<string, BucketEntry>();
// In-flight coalescing: when a burst of sweeps for the same bucket arrives
// before the first response lands, every later caller awaits the same
// Promise instead of firing its own Collector+Verifier round-trip. This is
// the dedup that actually saves money during traffic spikes; without it the
// 5-min TTL only helps after the first call has completed.
const bucketInFlight = new Map<string, Promise<GeneratedAlertsResult | null>>();

function bucketKeyForSpec(spec: InterestSpecData): string {
  // Only the fields that actually drive search results — strip user-specific
  // noise (intent, urgency) so equivalent topics collapse to one bucket.
  const norm = {
    topic: (spec.topic ?? "").toLowerCase().trim(),
    entities: [...(spec.entities ?? [])].map((s) => s.toLowerCase().trim()).sort(),
    locationScope: (spec.locationScope ?? "").toLowerCase().trim(),
    sources: [...(spec.suggestedSources ?? [])].sort(),
  };
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex").slice(0, 24);
}

function cacheGet(key: string): GeneratedAlertsResult | null {
  const e = bucketCache.get(key);
  if (!e) return null;
  if (Date.now() - e.storedAt > BUCKET_TTL_MS) {
    bucketCache.delete(key);
    return null;
  }
  return e.result;
}
function cacheSet(key: string, result: GeneratedAlertsResult): void {
  bucketCache.set(key, { result, storedAt: Date.now() });
  // Bound memory: prune oldest if cache balloons.
  if (bucketCache.size > 500) {
    const oldestKey = [...bucketCache.entries()].sort(
      (a, b) => a[1].storedAt - b[1].storedAt,
    )[0]?.[0];
    if (oldestKey) bucketCache.delete(oldestKey);
  }
}
// Periodic cleanup so memory doesn't grow unbounded under low traffic.
setInterval(() => {
  const cutoff = Date.now() - BUCKET_TTL_MS;
  for (const [k, v] of bucketCache.entries()) {
    if (v.storedAt < cutoff) bucketCache.delete(k);
  }
}, BUCKET_TTL_MS).unref?.();

let timer: NodeJS.Timeout | null = null;
let running = false;

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
}

function dedupKeyFor(a: AlertData): string {
  return a.source.url ? `url:${a.source.url}` : `title:${normalizeTitle(a.title)}`;
}

async function callGenerateAlerts(
  spec: InterestSpecData,
  count: number,
  existingAlertSummaries: { title: string; summary: string }[] = [],
): Promise<GeneratedAlertsResult | null> {
  const port = process.env["PORT"];
  if (!port) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/agents/generate-alerts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spec, count, existingAlertSummaries }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "[poller] generate-alerts non-2xx");
      return null;
    }
    return (await res.json()) as GeneratedAlertsResult;
  } catch (err) {
    logger.error({ err }, "[poller] generate-alerts call failed");
    return null;
  }
}

/**
 * Fetch alerts for a spec, using the spec-bucket cache when possible.
 *
 * IMPORTANT: the cached call deliberately does NOT pass per-interest
 * `existingAlertSummaries` — those are personal history and would poison the
 * shared bucket for everyone else (the LLM would skip stories one user has
 * already seen, denying them to a different user with empty history). Per-
 * interest dedup is enforced downstream by `seen_alerts` (URL/title hash),
 * so the bucket only needs to return a fresh batch of candidates; each
 * interest filters out what it has seen. We ask for `count + 4` so even if
 * one interest has already consumed the freshest item, others have spare
 * candidates.
 *
 * `force=true` skips both the cache and the in-flight coalesce — used by
 * boost so a paying user always pays for a brand-new fetch even when a
 * duplicate just ran.
 */
async function fetchAlertsForSpec(
  spec: InterestSpecData,
  count: number,
  force: boolean,
): Promise<{ result: GeneratedAlertsResult | null; fromCache: boolean }> {
  const key = bucketKeyForSpec(spec);
  if (!force) {
    const cached = cacheGet(key);
    if (cached) return { result: cached, fromCache: true };
    const pending = bucketInFlight.get(key);
    if (pending) {
      const result = await pending;
      return { result, fromCache: true };
    }
  }
  const fetchCount = Math.max(count + 4, 5);
  const promise = callGenerateAlerts(spec, fetchCount, []).then((result) => {
    if (result && result.alerts.length > 0) cacheSet(key, result);
    return result;
  });
  if (!force) bucketInFlight.set(key, promise);
  try {
    const result = await promise;
    return { result, fromCache: false };
  } finally {
    if (!force && bucketInFlight.get(key) === promise) {
      bucketInFlight.delete(key);
    }
  }
}

export async function sweepOne(rowInterestId: string, force = false): Promise<void> {
  // Re-read the row inside the sweep so a concurrent delete is observed.
  const [row] = await db
    .select()
    .from(trackedInterestsTable)
    .where(eq(trackedInterestsTable.interestId, rowInterestId))
    .limit(1);
  if (!row) return;

  const spec = row.spec as InterestSpecData & { plan?: PlanTier };
  const { result, fromCache } = await fetchAlertsForSpec(spec, 1, force);
  const now = new Date();

  await db
    .update(trackedInterestsTable)
    .set({ lastSweepAt: now })
    .where(eq(trackedInterestsTable.interestId, rowInterestId));

  if (!result || result.alerts.length === 0) {
    logger.debug(
      { interestId: rowInterestId, fromCache },
      "[poller] no alerts this sweep",
    );
    return;
  }

  const candidates = result.alerts.map((a) => ({
    alert: a,
    key: dedupKeyFor(a),
  }));
  const keys = candidates.map((c) => c.key);
  const existing = await db
    .select({ key: seenAlertsTable.dedupKey })
    .from(seenAlertsTable)
    .where(
      and(
        eq(seenAlertsTable.interestId, rowInterestId),
        inArray(seenAlertsTable.dedupKey, keys),
      ),
    );
  const existingSet = new Set(existing.map((e) => e.key));
  const fresh = candidates.filter((c) => !existingSet.has(c.key));
  if (fresh.length === 0) return;

  const claimed = await db
    .insert(seenAlertsTable)
    .values(
      fresh.map((c) => ({
        interestId: rowInterestId,
        dedupKey: c.key,
        title: c.alert.title.slice(0, 500),
        url: c.alert.source.url ?? null,
      })),
    )
    .onConflictDoNothing()
    .returning({ key: seenAlertsTable.dedupKey });
  const claimedKeys = new Set(claimed.map((r) => r.key));
  const ourFresh = fresh.filter((c) => claimedKeys.has(c.key));
  if (ourFresh.length === 0) return;

  const [stillTracked] = await db
    .select({ id: trackedInterestsTable.interestId })
    .from(trackedInterestsTable)
    .where(eq(trackedInterestsTable.interestId, rowInterestId))
    .limit(1);
  if (!stillTracked) {
    await db.delete(seenAlertsTable).where(eq(seenAlertsTable.interestId, rowInterestId));
    logger.info(
      { interestId: rowInterestId },
      "[poller] interest deleted mid-sweep; aborting push",
    );
    return;
  }

  await db
    .update(trackedInterestsTable)
    .set({ lastNewAt: now })
    .where(eq(trackedInterestsTable.interestId, rowInterestId));

  const [device] = await db
    .select()
    .from(pushDevicesTable)
    .where(eq(pushDevicesTable.deviceId, row.deviceId))
    .limit(1);
  if (!device) {
    logger.info(
      { interestId: rowInterestId },
      "[poller] no device token; skipping push",
    );
    return;
  }

  const top = [...ourFresh].sort((a, b) => {
    const am = a.alert.minutesAgo ?? 9999;
    const bm = b.alert.minutesAgo ?? 9999;
    if (am !== bm) return am - bm;
    return b.alert.confidence - a.alert.confidence;
  })[0]!;

  const extraCount = ourFresh.length - 1;
  const title = `${spec.topic} · 새 소식`;
  const body =
    extraCount > 0
      ? `${top.alert.title} (외 ${extraCount}건)`
      : top.alert.title;

  const messages: ExpoPushMessage[] = [
    {
      to: device.expoPushToken,
      title,
      body,
      sound: "default",
      priority: "high",
      channelId: "keyp-default",
      data: {
        interestId: rowInterestId,
        url: top.alert.source.url ?? null,
        freshCount: fresh.length,
        boost: force,
      },
    },
  ];
  const { invalidTokens } = await sendExpoPush(messages);

  if (invalidTokens.includes(device.expoPushToken)) {
    logger.info(
      { deviceId: row.deviceId },
      "[poller] evicting unregistered device token",
    );
    await db
      .delete(pushDevicesTable)
      .where(eq(pushDevicesTable.deviceId, row.deviceId));
  } else {
    logger.info(
      {
        interestId: rowInterestId,
        freshCount: ourFresh.length,
        cached: fromCache,
        boost: force,
      },
      "[poller] push dispatched",
    );
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Cheap prefilter: select rows whose lastSweepAt is older than the
    // FASTEST plan interval. Per-row plan check below decides if the row is
    // actually due (a free-tier row with a 30-min-old sweep won't be due yet).
    const cutoff = new Date(Date.now() - SCAN_FLOOR_MS);
    const due = await db
      .select({
        interestId: trackedInterestsTable.interestId,
        spec: trackedInterestsTable.spec,
        lastSweepAt: trackedInterestsTable.lastSweepAt,
      })
      .from(trackedInterestsTable)
      .where(
        or(
          isNull(trackedInterestsTable.lastSweepAt),
          lt(trackedInterestsTable.lastSweepAt, cutoff),
        ),
      )
      .limit(MAX_INTERESTS_PER_TICK * 4); // overfetch since many will fail per-plan check

    let swept = 0;
    for (const row of due) {
      if (swept >= MAX_INTERESTS_PER_TICK) break;
      const plan = ((row.spec as { plan?: PlanTier })?.plan) ?? "basic";
      const interval = planIntervalMs(plan);
      const last = row.lastSweepAt?.getTime() ?? 0;
      if (Date.now() - last < interval) continue;
      try {
        await sweepOne(row.interestId);
        swept++;
      } catch (err) {
        logger.error({ err, interestId: row.interestId }, "[poller] sweep failed");
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Atomically update the `plan` field on every tracked interest for a device.
 * Uses jsonb merge so we don't have to round-trip every row.
 */
export async function setPlanForDevice(deviceId: string, plan: PlanTier): Promise<number> {
  const result = await db
    .update(trackedInterestsTable)
    .set({
      spec: sql`${trackedInterestsTable.spec} || ${JSON.stringify({ plan })}::jsonb`,
    })
    .where(eq(trackedInterestsTable.deviceId, deviceId))
    .returning({ id: trackedInterestsTable.interestId });
  return result.length;
}

// ────────────────────────────────────────────────────────────────────────
// Boost (속보 알림) — manual immediate sweep with monthly per-device quota.
// Stored in-process; resets monthly. Production would back this with the
// DB, but for current single-instance deployment this is sufficient and
// avoids an extra migration.
// ────────────────────────────────────────────────────────────────────────

interface BoostUsage {
  monthKey: string; // YYYY-MM
  used: number;
}
const boostUsage = new Map<string, BoostUsage>();
function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface BoostResult {
  ok: boolean;
  reason?: "not_found" | "quota_exceeded" | "device_mismatch";
  used: number;
  quota: number;
  remaining: number;
}

export async function tryBoost(
  interestId: string,
  deviceId: string,
): Promise<BoostResult> {
  const [row] = await db
    .select()
    .from(trackedInterestsTable)
    .where(eq(trackedInterestsTable.interestId, interestId))
    .limit(1);
  if (!row) {
    return { ok: false, reason: "not_found", used: 0, quota: 0, remaining: 0 };
  }
  if (row.deviceId !== deviceId) {
    return { ok: false, reason: "device_mismatch", used: 0, quota: 0, remaining: 0 };
  }
  const plan = ((row.spec as { plan?: PlanTier })?.plan) ?? "basic";
  const quota = planBoostQuota(plan);

  const mk = monthKey();
  const usage = boostUsage.get(deviceId);
  const current =
    usage && usage.monthKey === mk ? usage : { monthKey: mk, used: 0 };
  if (current.used >= quota) {
    return {
      ok: false,
      reason: "quota_exceeded",
      used: current.used,
      quota,
      remaining: 0,
    };
  }
  current.used += 1;
  boostUsage.set(deviceId, current);

  // Run sweep in background — return immediately so the client doesn't wait
  // for the LLM round-trip.
  void sweepOne(interestId, true).catch((err) => {
    logger.error({ err, interestId }, "[boost] sweep failed");
  });

  return {
    ok: true,
    used: current.used,
    quota,
    remaining: quota - current.used,
  };
}

export function getBoostStatus(deviceId: string, plan: PlanTier): BoostResult {
  const quota = planBoostQuota(plan);
  const mk = monthKey();
  const usage = boostUsage.get(deviceId);
  const used = usage && usage.monthKey === mk ? usage.used : 0;
  return { ok: true, used, quota, remaining: Math.max(0, quota - used) };
}

export function startPollerCron(): void {
  if (timer) return;
  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  }, 5_000);
  logger.info(
    { tickMs: TICK_INTERVAL_MS, planIntervals: PLAN_INTERVAL_MS, bucketTtlMs: BUCKET_TTL_MS },
    "[poller] cron started",
  );
}
