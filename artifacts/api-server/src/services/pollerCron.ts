import { and, eq, lt, isNull, or, inArray, desc } from "drizzle-orm";
import {
  db,
  trackedInterestsTable,
  seenAlertsTable,
  pushDevicesTable,
} from "@workspace/db";
import type { GeneratedAlertsResult, InterestSpecData, AlertData } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendExpoPush, type ExpoPushMessage } from "./expoPush";

// Background sweep cadence. Each interest is only refetched if its last sweep
// is older than this. The cron tick runs more often (every 30s) so newly added
// interests don't have to wait a full interval for their first poll.
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;
const TICK_INTERVAL_MS = 30 * 1000;
const MAX_INTERESTS_PER_TICK = 10;

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

async function sweepOne(rowInterestId: string): Promise<void> {
  // Re-read the row inside the sweep so a concurrent delete is observed.
  const [row] = await db
    .select()
    .from(trackedInterestsTable)
    .where(eq(trackedInterestsTable.interestId, rowInterestId))
    .limit(1);
  if (!row) return;

  const spec = row.spec as InterestSpecData;
  // Pull the most recent 30 already-seen titles for this interest so the
  // Verifier can suppress semantic duplicates (same story republished by a
  // different outlet under a different URL/title) BEFORE we waste a push.
  const seenRows = await db
    .select({ title: seenAlertsTable.title })
    .from(seenAlertsTable)
    .where(eq(seenAlertsTable.interestId, rowInterestId))
    .orderBy(desc(seenAlertsTable.seenAt))
    .limit(30);
  const existingAlertSummaries = seenRows.map((r) => ({
    title: r.title,
    summary: r.title,
  }));
  // Fetch exactly ONE per sweep — KeyP's "딱 하나만" rule. count=1 also
  // activates the server-side seed-rescue path so a Verifier-filtered batch
  // still surfaces the freshest novel candidate, and the final dedup gate
  // compares it against existingAlertSummaries built from prior seen_alerts.
  const result = await callGenerateAlerts(spec, 1, existingAlertSummaries);
  const now = new Date();

  // Always advance lastSweepAt — even on failure — so a permanently-broken
  // interest doesn't monopolize every tick.
  await db
    .update(trackedInterestsTable)
    .set({ lastSweepAt: now })
    .where(eq(trackedInterestsTable.interestId, rowInterestId));

  if (!result || result.alerts.length === 0) return;

  // Compute candidate dedup keys, then check which are already in seen_alerts.
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

  // Atomic claim: only the rows we *actually inserted* are ours to deliver.
  // RETURNING combined with ON CONFLICT DO NOTHING means a concurrent worker
  // that loses the race for a given dedupKey will simply not see it here, so
  // we'll never double-send the same item across overlapping sweepers.
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

  // Close the delete-race window: if the user untracked this interest after
  // we picked it up, /api/push/track-interest/:id has already wiped both the
  // tracked row AND the seen_alerts rows for it. Our just-inserted seen_alerts
  // would then be orphans that "rehydrate" the interest forever, and we'd
  // also fire a push for an interest the user just removed. Re-check + clean
  // up before sending push.
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

  // Look up the device's push token. If the device unregistered, we still
  // keep the tracked interest (the user may re-register later).
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

  // Pick the freshest single alert (highest confidence as tiebreaker) so a
  // burst of N items results in ONE notification, not N.
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
      { interestId: rowInterestId, freshCount: ourFresh.length },
      "[poller] push dispatched",
    );
  }
}

async function tick(): Promise<void> {
  if (running) return; // skip overlapping tick
  running = true;
  try {
    const cutoff = new Date(Date.now() - SWEEP_INTERVAL_MS);
    // Pick interests that have either never been swept or whose last sweep is
    // older than the interval. Oldest-first to keep the queue fair.
    const due = await db
      .select({ interestId: trackedInterestsTable.interestId })
      .from(trackedInterestsTable)
      .where(
        or(
          isNull(trackedInterestsTable.lastSweepAt),
          lt(trackedInterestsTable.lastSweepAt, cutoff),
        ),
      )
      .limit(MAX_INTERESTS_PER_TICK);

    for (const row of due) {
      try {
        await sweepOne(row.interestId);
      } catch (err) {
        logger.error({ err, interestId: row.interestId }, "[poller] sweep failed");
      }
    }
  } finally {
    running = false;
  }
}

export function startPollerCron(): void {
  if (timer) return;
  // Defer the first tick so the HTTP server is fully listening before any
  // loopback /api/agents/generate-alerts call is attempted.
  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  }, 5_000);
  logger.info(
    { tickMs: TICK_INTERVAL_MS, sweepMs: SWEEP_INTERVAL_MS },
    "[poller] cron started",
  );
}
