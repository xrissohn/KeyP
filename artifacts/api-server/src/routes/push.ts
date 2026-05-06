import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";

// Stable 32-bit signed int from a device id, for pg_advisory_xact_lock.
// The hash quality only matters for collision rate (false serialization);
// correctness comes from the lock itself.
function deviceLockKey(deviceId: string): number {
  let h = 5381;
  for (let i = 0; i < deviceId.length; i++) {
    h = ((h << 5) + h + deviceId.charCodeAt(i)) | 0;
  }
  return h;
}
import {
  db,
  pushDevicesTable,
  trackedInterestsTable,
  seenAlertsTable,
  webPushSubscriptionsTable,
} from "@workspace/db";
import {
  RegisterDeviceBody,
  RegisterDeviceResponse as RegisterDeviceResultSchema,
  TrackInterestBody,
  TrackInterestResponse as TrackInterestResultSchema,
  PushTestBody,
  PushTestResponse as PushTestResultSchema,
} from "@workspace/api-zod";
import { sendExpoPush, isExpoPushToken } from "../services/expoPush";
import { getVapidPublicKey, sendWebPushToDevice } from "../services/webPush";
import { recordFeedback, type FeedbackKind } from "../services/feedbackProfile";
import { bumpReputation, hostFromUrl } from "../services/sourceReputation";
import {
  setPlanForDevice,
  tryBoost,
  getBoostStatus,
  getPlanForDevice,
  planInterestCap,
  type PlanTier,
} from "../services/pollerCron";

const router: IRouter = Router();

const VALID_PLANS: ReadonlyArray<PlanTier> = ["free", "basic", "pro", "power"];

router.post("/push/register-device", async (req, res) => {
  const parsed = RegisterDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { deviceId, expoPushToken, platform } = parsed.data;
  if (!isExpoPushToken(expoPushToken)) {
    res.status(400).json({ error: "expoPushToken does not look like an Expo push token" });
    return;
  }
  // Upsert: same device may rotate its token (reinstall, restore from backup).
  await db
    .insert(pushDevicesTable)
    .values({ deviceId, expoPushToken, platform })
    .onConflictDoUpdate({
      target: pushDevicesTable.deviceId,
      set: { expoPushToken, platform, updatedAt: new Date() },
    });
  res.json(RegisterDeviceResultSchema.parse({ ok: true }));
});

router.post("/push/track-interest", async (req, res) => {
  const parsed = TrackInterestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { interestId, deviceId, spec, rawText } = parsed.data;
  // Pluck userLanguage off raw body (kept off the zod schema to avoid
  // codegen ripple). Whitelist to 'ko'/'en'; default 'ko' for legacy clients.
  const rawLang = (req.body as { userLanguage?: unknown } | undefined)?.userLanguage;
  const userLanguage: "ko" | "en" = rawLang === "en" ? "en" : "ko";
  const devicePlan = await getPlanForDevice(deviceId);
  const cap = planInterestCap(devicePlan);
  // Plan propagation: a newly tracked interest inherits the plan of the
  // device's other interests so cadence/quota stay consistent (otherwise the
  // poller defaults to "basic" and a Pro user's new topic would silently
  // poll slower than their existing ones until the next /push/set-plan).
  let mergedSpec: typeof spec & { plan?: PlanTier; userLanguage?: "ko" | "en" } = {
    ...spec,
    userLanguage,
  };
  if (!(spec as { plan?: PlanTier }).plan && VALID_PLANS.includes(devicePlan)) {
    mergedSpec = { ...mergedSpec, plan: devicePlan };
  }

  // Plan-tier interest cap (free=3, basic=5, pro=15, power=30) enforced
  // atomically. Without a transaction + per-device advisory lock, two
  // concurrent track requests could both pass the count check and exceed
  // the cap (architect-flagged race). We hash the deviceId to a 32-bit int
  // so pg_advisory_xact_lock serializes ONLY same-device traffic — other
  // devices are unaffected. The lock auto-releases at COMMIT/ROLLBACK.
  // The current interestId is excluded from the count so an idempotent
  // re-track (client retry) at the cap is allowed.
  const lockKey = deviceLockKey(deviceId);
  let limitHit: { used: number } | null = null;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${lockKey})`);
    const existing = await tx
      .select({ id: trackedInterestsTable.interestId })
      .from(trackedInterestsTable)
      .where(eq(trackedInterestsTable.deviceId, deviceId));
    const distinctOthers = existing.filter((row) => row.id !== interestId).length;
    if (distinctOthers >= cap) {
      limitHit = { used: distinctOthers };
      return;
    }
    await tx
      .insert(trackedInterestsTable)
      .values({ interestId, deviceId, spec: mergedSpec, rawText: rawText ?? null })
      .onConflictDoUpdate({
        target: trackedInterestsTable.interestId,
        // Ownership transfer: if the same interestId is reattached to a new
        // device (rare; only on restore), update the spec/device but keep
        // sweep history intact.
        set: { deviceId, spec: mergedSpec, rawText: rawText ?? null },
      });
  });
  if (limitHit) {
    res.status(403).json({
      error: "plan_limit",
      code: "PLAN_LIMIT",
      plan: devicePlan,
      used: (limitHit as { used: number }).used,
      limit: cap,
    });
    return;
  }
  res.json(TrackInterestResultSchema.parse({ ok: true, interestId }));
});

router.delete("/push/track-interest/:interestId", async (req, res) => {
  const interestId = req.params["interestId"];
  if (!interestId) {
    res.status(400).json({ error: "Missing interestId" });
    return;
  }
  // Cascade: drop the seen-alerts dedup history too so re-adding the same
  // interest later starts clean.
  await db.delete(seenAlertsTable).where(eq(seenAlertsTable.interestId, interestId));
  await db
    .delete(trackedInterestsTable)
    .where(eq(trackedInterestsTable.interestId, interestId));
  res.json({ ok: true });
});

router.post("/push/test", async (req, res) => {
  const parsed = PushTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { deviceId } = parsed.data;
  const [device] = await db
    .select()
    .from(pushDevicesTable)
    .where(eq(pushDevicesTable.deviceId, deviceId))
    .limit(1);
  if (!device) {
    res.status(404).json({ error: "Device not registered" });
    return;
  }
  const { tickets, invalidTokens } = await sendExpoPush([
    {
      to: device.expoPushToken,
      title: "KeyP 알림 테스트",
      body: "푸시가 정상적으로 작동합니다.",
      sound: "default",
      priority: "high",
      channelId: "keyp-default",
      data: { test: true },
    },
  ]);
  res.json(
    PushTestResultSchema.parse({
      ok: invalidTokens.length === 0 && tickets[0]?.status === "ok",
      ticket: tickets[0]?.status ?? "no-ticket",
    }),
  );
});

// ─────────────────────────── Plan & Boost ──────────────────────────────
//
// Plan determines polling cadence and boost (속보) quota. We store the plan
// inside the spec JSON of every tracked interest so the poller can pick it
// up without a schema change. Setting a plan is an atomic UPDATE across all
// of the device's tracked rows.
//
// AUTH NOTE: this endpoint trusts deviceId the same way every other /push/*
// endpoint does (consistent with the app's existing session model — no JWT
// yet). To raise the bar minimally we require the deviceId to be a known
// registered push device before allowing plan mutations. Real billing
// enforcement will arrive with the auth refactor and a server-side
// `device_plans` table; until then this prevents drive-by tampering by
// random IDs while keeping the existing app working.
router.post("/push/set-plan", async (req, res) => {
  const body = req.body as { deviceId?: unknown; plan?: unknown } | undefined;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const plan = typeof body?.plan === "string" ? (body.plan as PlanTier) : "";
  if (!deviceId || !VALID_PLANS.includes(plan as PlanTier)) {
    res.status(400).json({ error: "Invalid deviceId or plan" });
    return;
  }
  const [knownDevice] = await db
    .select({ id: pushDevicesTable.deviceId })
    .from(pushDevicesTable)
    .where(eq(pushDevicesTable.deviceId, deviceId))
    .limit(1);
  if (!knownDevice) {
    res.status(403).json({ error: "Unknown device" });
    return;
  }
  const updatedCount = await setPlanForDevice(deviceId, plan as PlanTier);
  const boost = await getBoostStatus(deviceId, plan as PlanTier);
  res.json({
    ok: true,
    plan,
    updatedCount,
    interestCap: planInterestCap(plan),
    boost,
  });
});

router.post("/push/boost", async (req, res) => {
  const body = req.body as { deviceId?: unknown; interestId?: unknown } | undefined;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const interestId = typeof body?.interestId === "string" ? body.interestId : "";
  if (!deviceId || !interestId) {
    res.status(400).json({ error: "Missing deviceId or interestId" });
    return;
  }
  const result = await tryBoost(interestId, deviceId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    res.status(status).json(result);
    return;
  }
  res.json(result);
});

// ─────────────────────────── Feedback ──────────────────────────────────
//
// Records user reactions to alerts (like/dislike/more/hide). Persisted via
// feedbackProfile.recordFeedback so the agents pipeline can prioritize
// candidates BEFORE expensive Verifier calls and bias confidence scoring.
const VALID_FEEDBACK_KINDS = new Set<FeedbackKind>(["like", "dislike", "more", "hide"]);

router.post("/push/feedback", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const deviceId = typeof body["deviceId"] === "string" ? (body["deviceId"] as string) : "";
  const alertId = typeof body["alertId"] === "string" ? (body["alertId"] as string) : "";
  const feedback =
    typeof body["feedback"] === "string" ? (body["feedback"] as FeedbackKind) : ("" as FeedbackKind);
  const title = typeof body["title"] === "string" ? (body["title"] as string) : "";
  const summary = typeof body["summary"] === "string" ? (body["summary"] as string) : "";
  if (!deviceId || !alertId || !VALID_FEEDBACK_KINDS.has(feedback)) {
    res.status(400).json({ error: "Invalid deviceId/alertId/feedback" });
    return;
  }
  const [knownDevice] = await db
    .select({ id: pushDevicesTable.deviceId })
    .from(pushDevicesTable)
    .where(eq(pushDevicesTable.deviceId, deviceId))
    .limit(1);
  if (!knownDevice) {
    res.status(403).json({ error: "Unknown device" });
    return;
  }
  const interestId =
    typeof body["interestId"] === "string" ? (body["interestId"] as string) : undefined;
  const sourceType =
    typeof body["sourceType"] === "string" ? (body["sourceType"] as string) : undefined;
  const sourceName =
    typeof body["sourceName"] === "string" ? (body["sourceName"] as string) : undefined;
  const tagsRaw = body["tags"];
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((t): t is string => typeof t === "string").slice(0, 12)
    : undefined;

  await recordFeedback({
    deviceId,
    alertId,
    interestId,
    title,
    summary,
    sourceType,
    sourceName,
    tags,
    feedback,
    ts: Date.now(),
  });
  // Persist per-host reputation so source quality survives interest deletion.
  const sourceUrl =
    typeof body["sourceUrl"] === "string" ? (body["sourceUrl"] as string) : undefined;
  const host = hostFromUrl(sourceUrl);
  if (host) {
    const delta =
      feedback === "like"
        ? { likes: 1 }
        : feedback === "more"
        ? { moreCount: 1 }
        : feedback === "dislike"
        ? { dislikes: 1 }
        : { hideCount: 1 };
    await bumpReputation(host, deviceId, delta);
  }
  req.log.info(
    { feedback, titlePreview: title.slice(0, 60), host },
    "[feedback] recorded",
  );
  res.json({ ok: true });
});

// ─────────────────────────── Web Push (PWA / browser) ─────────────────
//
// Browsers subscribe via PushManager.subscribe({applicationServerKey}) and
// POST the resulting subscription here. Endpoint URL is unique per browser
// install and acts as the primary key; we tie it to the KeyP deviceId so
// the poller can fan out alerts to every installed surface.

router.get("/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: "vapid_not_configured" });
    return;
  }
  res.json({ publicKey: key });
});

router.post("/push/web-subscribe", async (req, res) => {
  const body = (req.body ?? {}) as {
    deviceId?: unknown;
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    userAgent?: unknown;
  };
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const sub = body.subscription;
  const endpoint =
    sub && typeof sub.endpoint === "string" && sub.endpoint.length > 0
      ? sub.endpoint
      : "";
  const p256dh =
    sub?.keys && typeof sub.keys.p256dh === "string" ? sub.keys.p256dh : "";
  const auth =
    sub?.keys && typeof sub.keys.auth === "string" ? sub.keys.auth : "";
  const userAgent =
    typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : null;
  if (!deviceId || !endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Missing deviceId or subscription fields" });
    return;
  }
  await db
    .insert(webPushSubscriptionsTable)
    .values({ endpoint, deviceId, p256dh, auth, userAgent })
    .onConflictDoUpdate({
      target: webPushSubscriptionsTable.endpoint,
      set: { deviceId, p256dh, auth, userAgent, updatedAt: new Date() },
    });
  res.json({ ok: true });
});

router.post("/push/web-unsubscribe", async (req, res) => {
  const body = (req.body ?? {}) as { endpoint?: unknown };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }
  await db
    .delete(webPushSubscriptionsTable)
    .where(eq(webPushSubscriptionsTable.endpoint, endpoint));
  res.json({ ok: true });
});

router.post("/push/web-test", async (req, res) => {
  const body = (req.body ?? {}) as { deviceId?: unknown };
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (!deviceId) {
    res.status(400).json({ error: "Missing deviceId" });
    return;
  }
  const result = await sendWebPushToDevice(deviceId, {
    title: "KeyP",
    body: "웹 푸시가 정상적으로 작동합니다.",
    url: "/",
    tag: "keyp-test",
  });
  res.json({ ok: result.sent > 0, ...result });
});

// Suppress unused-binding warning for the and import (kept for future filters).
void and;

export default router;
