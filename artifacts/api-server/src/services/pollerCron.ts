import { and, eq, lt, isNull, or, inArray, desc, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  db,
  trackedInterestsTable,
  seenAlertsTable,
  pushDevicesTable,
  devicePlansTable,
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
  basic: 2,
  pro: 10,
  power: 50,
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

// Mirror of the client-side semantic dedup in AppContext / agents route.
// Char-bigram Jaccard over a punctuation-stripped (title + summary) string.
// Korean-friendly because morphology-aware tokenization is not required.
function _normalizeForDedup(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}
function _bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
function semanticSimilarity(a: string, b: string): number {
  const na = _normalizeForDedup(a);
  const nb = _normalizeForDedup(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = _bigrams(na);
  const bb = _bigrams(nb);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  const union = ba.size + bb.size - inter;
  return union === 0 ? 0 : inter / union;
}
const SEMANTIC_DEDUP_THRESHOLD = 0.45;

/**
 * Resolve the effective plan for a device. device_plans is the source of
 * truth; the legacy spec.plan is used as a fallback for rows written before
 * the migration.
 */
async function resolvePlan(
  deviceId: string,
  fallbackFromSpec: PlanTier | undefined,
): Promise<PlanTier> {
  const [row] = await db
    .select({ plan: devicePlansTable.plan })
    .from(devicePlansTable)
    .where(eq(devicePlansTable.deviceId, deviceId))
    .limit(1);
  if (row?.plan) return row.plan as PlanTier;
  return fallbackFromSpec ?? "free";
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
  // Pull recent seen rows (title + summary) for this interest so we can run
  // the semantic gate. We fetch by interestId rather than by dedupKey so the
  // semantic check sees ALL recent items, not just URL/title-hash collisions.
  const recentSeen = await db
    .select({
      key: seenAlertsTable.dedupKey,
      title: seenAlertsTable.title,
      summary: seenAlertsTable.summary,
    })
    .from(seenAlertsTable)
    .where(eq(seenAlertsTable.interestId, rowInterestId))
    .orderBy(desc(seenAlertsTable.seenAt))
    .limit(200);
  const existingSet = new Set(recentSeen.filter((r) => keys.includes(r.key)).map((r) => r.key));
  const semanticFingerprints = recentSeen.map((r) =>
    `${r.title} ${r.summary ?? ""}`.trim(),
  );

  const fresh = candidates.filter((c) => {
    if (existingSet.has(c.key)) return false;
    const candidateText = `${c.alert.title} ${c.alert.summary ?? ""}`.trim();
    for (const fp of semanticFingerprints) {
      if (semanticSimilarity(candidateText, fp) >= SEMANTIC_DEDUP_THRESHOLD) {
        return false;
      }
    }
    return true;
  });
  if (fresh.length === 0) return;

  const claimed = await db
    .insert(seenAlertsTable)
    .values(
      fresh.map((c) => ({
        interestId: rowInterestId,
        dedupKey: c.key,
        title: c.alert.title.slice(0, 500),
        summary: c.alert.summary ? c.alert.summary.slice(0, 1000) : null,
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
    // Look up device plans in one shot for the rows in this batch so we
    // don't N+1 a SELECT per interest. Falls back to the spec.plan copy
    // when no device_plans row exists yet (legacy rows).
    const deviceIds = await db
      .select({
        interestId: trackedInterestsTable.interestId,
        deviceId: trackedInterestsTable.deviceId,
      })
      .from(trackedInterestsTable)
      .where(inArray(trackedInterestsTable.interestId, due.map((r) => r.interestId)));
    const deviceIdByInterest = new Map(deviceIds.map((r) => [r.interestId, r.deviceId]));
    const uniqueDeviceIds = [...new Set(deviceIds.map((r) => r.deviceId))];
    const planRows = uniqueDeviceIds.length
      ? await db
          .select({ deviceId: devicePlansTable.deviceId, plan: devicePlansTable.plan })
          .from(devicePlansTable)
          .where(inArray(devicePlansTable.deviceId, uniqueDeviceIds))
      : [];
    const planByDevice = new Map(planRows.map((r) => [r.deviceId, r.plan as PlanTier]));

    for (const row of due) {
      if (swept >= MAX_INTERESTS_PER_TICK) break;
      const fallbackPlan = ((row.spec as { plan?: PlanTier })?.plan) as PlanTier | undefined;
      const deviceId = deviceIdByInterest.get(row.interestId);
      const plan: PlanTier =
        (deviceId ? planByDevice.get(deviceId) : undefined) ?? fallbackPlan ?? "free";
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
 * Atomically update the `plan` field on every tracked interest for a device,
 * AND upsert the canonical row in device_plans (the source of truth post-
 * migration). The JSONB write is preserved for backwards compat so any code
 * still reading spec.plan keeps working.
 */
export async function setPlanForDevice(deviceId: string, plan: PlanTier): Promise<number> {
  await db
    .insert(devicePlansTable)
    .values({ deviceId, plan, boostQuotaUsed: 0, boostQuotaPeriod: monthKey() })
    .onConflictDoUpdate({
      target: devicePlansTable.deviceId,
      set: { plan, updatedAt: new Date() },
    });
  const result = await db
    .update(trackedInterestsTable)
    .set({
      spec: sql`${trackedInterestsTable.spec} || ${JSON.stringify({ plan })}::jsonb`,
    })
    .where(eq(trackedInterestsTable.deviceId, deviceId))
    .returning({ id: trackedInterestsTable.interestId });
  return result.length;
}

/**
 * Read the persisted plan for a device. Returns 'free' when no row exists.
 */
export async function getPlanForDevice(deviceId: string): Promise<PlanTier> {
  const [row] = await db
    .select({ plan: devicePlansTable.plan })
    .from(devicePlansTable)
    .where(eq(devicePlansTable.deviceId, deviceId))
    .limit(1);
  return (row?.plan as PlanTier) ?? "free";
}

// ────────────────────────────────────────────────────────────────────────
// Boost (속보 알림) — manual immediate sweep with monthly per-device quota.
// Persisted in `device_plans` so quota survives restart. The increment is
// done in a single atomic SQL statement to avoid a read-then-write race
// when a user double-taps the boost button.
// ────────────────────────────────────────────────────────────────────────

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
  const plan = await resolvePlan(
    deviceId,
    (row.spec as { plan?: PlanTier })?.plan,
  );
  const quota = planBoostQuota(plan);
  const mk = monthKey();

  // Ensure a device_plans row exists so the atomic UPDATE has something to
  // hit. If the user has never called set-plan we materialize the default
  // 'free' row here.
  await db
    .insert(devicePlansTable)
    .values({ deviceId, plan, boostQuotaUsed: 0, boostQuotaPeriod: mk })
    .onConflictDoNothing();

  // Atomic increment: in one SQL statement, reset used→0 if the period
  // rolled over, then bump used by 1 only if used+1 <= quota. RETURNING
  // tells us whether the row was actually updated. No read-then-write race
  // possible because the WHERE predicate is evaluated inside the same
  // transactional UPDATE.
  const updated = await db
    .update(devicePlansTable)
    .set({
      boostQuotaUsed: sql`CASE WHEN ${devicePlansTable.boostQuotaPeriod} = ${mk} THEN ${devicePlansTable.boostQuotaUsed} + 1 ELSE 1 END`,
      boostQuotaPeriod: mk,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(devicePlansTable.deviceId, deviceId),
        sql`(CASE WHEN ${devicePlansTable.boostQuotaPeriod} = ${mk} THEN ${devicePlansTable.boostQuotaUsed} ELSE 0 END) + 1 <= ${quota}`,
      ),
    )
    .returning({
      used: devicePlansTable.boostQuotaUsed,
    });

  if (updated.length === 0) {
    // Either quota exceeded for current period or quota is 0 for this plan.
    const [current] = await db
      .select({
        used: devicePlansTable.boostQuotaUsed,
        period: devicePlansTable.boostQuotaPeriod,
      })
      .from(devicePlansTable)
      .where(eq(devicePlansTable.deviceId, deviceId))
      .limit(1);
    const used = current && current.period === mk ? current.used : 0;
    return {
      ok: false,
      reason: "quota_exceeded",
      used,
      quota,
      remaining: Math.max(0, quota - used),
    };
  }

  const used = updated[0]!.used;

  // Run sweep in background — return immediately so the client doesn't wait
  // for the LLM round-trip.
  void sweepOne(interestId, true).catch((err) => {
    logger.error({ err, interestId }, "[boost] sweep failed");
  });

  return {
    ok: true,
    used,
    quota,
    remaining: Math.max(0, quota - used),
  };
}

export async function getBoostStatus(
  deviceId: string,
  plan: PlanTier,
): Promise<BoostResult> {
  const quota = planBoostQuota(plan);
  const mk = monthKey();
  const [row] = await db
    .select({
      used: devicePlansTable.boostQuotaUsed,
      period: devicePlansTable.boostQuotaPeriod,
    })
    .from(devicePlansTable)
    .where(eq(devicePlansTable.deviceId, deviceId))
    .limit(1);
  const used = row && row.period === mk ? row.used : 0;
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
