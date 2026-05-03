import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  pushDevicesTable,
  trackedInterestsTable,
  seenAlertsTable,
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
import { recordFeedback, type FeedbackKind } from "../services/feedbackProfile";
import {
  setPlanForDevice,
  tryBoost,
  getBoostStatus,
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
  // Plan propagation: a newly tracked interest inherits the plan of the
  // device's other interests so cadence/quota stay consistent (otherwise the
  // poller defaults to "basic" and a Pro user's new topic would silently
  // poll slower than their existing ones until the next /push/set-plan).
  let mergedSpec: typeof spec & { plan?: PlanTier } = spec;
  if (!(spec as { plan?: PlanTier }).plan) {
    const [existing] = await db
      .select({ spec: trackedInterestsTable.spec })
      .from(trackedInterestsTable)
      .where(eq(trackedInterestsTable.deviceId, deviceId))
      .limit(1);
    const inheritedPlan = (existing?.spec as { plan?: PlanTier } | undefined)?.plan;
    if (inheritedPlan && VALID_PLANS.includes(inheritedPlan)) {
      mergedSpec = { ...spec, plan: inheritedPlan };
    }
  }
  await db
    .insert(trackedInterestsTable)
    .values({ interestId, deviceId, spec: mergedSpec, rawText: rawText ?? null })
    .onConflictDoUpdate({
      target: trackedInterestsTable.interestId,
      // Ownership transfer: if the same interestId is reattached to a new
      // device (rare; only on restore), update the spec/device but keep
      // sweep history intact.
      set: { deviceId, spec: mergedSpec, rawText: rawText ?? null },
    });
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
  res.json({
    ok: true,
    plan,
    updatedCount,
    interestCap: planInterestCap(plan),
    boost: getBoostStatus(deviceId, plan as PlanTier),
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
  req.log.info(
    { feedback, titlePreview: title.slice(0, 60) },
    "[feedback] recorded",
  );
  res.json({ ok: true });
});

// Suppress unused-binding warning for the and import (kept for future filters).
void and;

export default router;
