import { Router, type IRouter } from "express";
import { db, pushDevicesTable, trackedInterestsTable, seenAlertsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  getBlacklistSize,
  getRecentBlacklistedEntries,
} from "../services/deadUrlBlacklist";

const router: IRouter = Router();

// Read-only observability endpoint. Counts only — no PII payloads.
// Intended for development/debugging; in production you'd gate this behind
// an admin token or remove it entirely.
// Token gate: when ADMIN_TOKEN is set, require `x-admin-token` header to match.
// When unset, the route is disabled in production-like environments and returns 404.
router.get("/admin/stats", async (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "not found" });
      return;
    }
    // dev: allow without token
  } else if (req.header("x-admin-token") !== adminToken) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const [devices] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(pushDevicesTable);
    const [interests] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(trackedInterestsTable);
    const [seen] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(seenAlertsTable);
    const blacklistSize = getBlacklistSize();
    const recentBlacklist = (await getRecentBlacklistedEntries(10)).map((e) => ({
      host: (() => {
        try {
          return new URL(e.url).host;
        } catch {
          return "(invalid)";
        }
      })(),
      reason: e.reason,
      ts: e.ts,
    }));

    res.json({
      pushDevices: devices?.n ?? 0,
      trackedInterests: interests?.n ?? 0,
      seenAlerts: seen?.n ?? 0,
      blacklist: { size: blacklistSize, recent: recentBlacklist },
    });
  } catch (err) {
    req.log.warn({ err }, "[admin] stats failed");
    res.status(500).json({ error: "stats failed" });
  }
});

export default router;
