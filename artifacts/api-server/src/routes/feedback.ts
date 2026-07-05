import { Router, type IRouter } from "express";
import { db, userReportsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const ReportBody = z.object({
  deviceId: z.string().min(4).max(128),
  alertId: z.string().max(128).optional(),
  interestId: z.string().max(128).optional(),
  kind: z.enum(["feedback", "abuse", "bug", "other"]).optional(),
  body: z.string().min(1).max(4000),
  contact: z.string().max(256).optional(),
});

router.post("/feedback/report", async (req, res) => {
  const parsed = ReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  try {
    await db.insert(userReportsTable).values({
      deviceId: data.deviceId,
      alertId: data.alertId ?? null,
      interestId: data.interestId ?? null,
      kind: data.kind ?? "feedback",
      body: data.body,
      contact: data.contact ?? null,
    });
    req.log.info(
      { deviceId: data.deviceId, kind: data.kind ?? "feedback", len: data.body.length },
      "[feedback] report received",
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "[feedback] insert failed");
    res.status(500).json({ ok: false, error: "insert_failed" });
  }
});

export default router;
