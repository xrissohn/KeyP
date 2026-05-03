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

const router: IRouter = Router();

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
  await db
    .insert(trackedInterestsTable)
    .values({ interestId, deviceId, spec, rawText: rawText ?? null })
    .onConflictDoUpdate({
      target: trackedInterestsTable.interestId,
      // Ownership transfer: if the same interestId is reattached to a new
      // device (rare; only on restore), update the spec/device but keep
      // sweep history intact.
      set: { deviceId, spec, rawText: rawText ?? null },
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

// Suppress unused-binding warning for the and import (kept for future filters).
void and;

export default router;
