import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  pushDevicesTable,
  trackedInterestsTable,
  seenAlertsTable,
  sourceReputationTable,
} from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import {
  getBlacklistSize,
  getRecentBlacklistedEntries,
} from "../services/deadUrlBlacklist";
import { getAdminContext } from "../lib/adminAuth";

const router: IRouter = Router();

/**
 * Admin gate. Two acceptance paths:
 *  - `x-admin-token` header matching `ADMIN_TOKEN` (legacy ops path).
 *  - Clerk-authenticated session whose user email is in ADMIN_EMAILS.
 *
 * In non-production environments without an ADMIN_TOKEN configured we allow
 * dev convenience access so engineers can hit the dashboard locally.
 */
async function checkAdmin(req: Request, res: Response): Promise<boolean> {
  const ctx = await getAdminContext(req);
  if (ctx.isAdmin) return true;
  if (
    process.env["NODE_ENV"] !== "production" &&
    !process.env["ADMIN_TOKEN"]
  ) {
    return true;
  }
  res.status(404).json({ error: "not found" });
  return false;
}

/**
 * Lightweight identity probe — clients hit this to determine whether the
 * currently signed-in user has admin privileges (so the mobile app can show
 * or hide the Admin Dashboard menu). Always 200 with `{ isAdmin, email }`.
 */
router.get("/admin/me", async (req, res) => {
  const ctx = await getAdminContext(req);
  res.json({ isAdmin: ctx.isAdmin, email: ctx.email, via: ctx.via });
});

// Read-only observability endpoint. Counts only — no PII payloads.
router.get("/admin/stats", async (req, res) => {
  if (!(await checkAdmin(req, res))) return;
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

/**
 * Verifier operations dashboard. See route body for response shape.
 */
router.get("/admin/verifier-stats", async (req, res) => {
  if (!(await checkAdmin(req, res))) return;
  try {
    const limit = Math.max(
      1,
      Math.min(50, parseInt(String(req.query["limit"] ?? ""), 10) || 20),
    );

    const rows = await db
      .select({
        host: sourceReputationTable.host,
        verifierPassCount: sourceReputationTable.verifierPassCount,
        verifierRejectCount: sourceReputationTable.verifierRejectCount,
        confidenceSum: sourceReputationTable.confidenceSum,
        confidenceCount: sourceReputationTable.confidenceCount,
        deadCount: sourceReputationTable.deadCount,
        staleRejectCount: sourceReputationTable.staleRejectCount,
        offTopicRejectCount: sourceReputationTable.offTopicRejectCount,
        dupRejectCount: sourceReputationTable.dupRejectCount,
      })
      .from(sourceReputationTable)
      .where(sql`${sourceReputationTable.deviceId} = '__global__'`);

    let totalPass = 0;
    let totalReject = 0;
    let totalConfSum = 0;
    let totalConfCount = 0;
    const enriched = rows.map((r) => {
      totalPass += r.verifierPassCount;
      totalReject += r.verifierRejectCount;
      totalConfSum += r.confidenceSum;
      totalConfCount += r.confidenceCount;
      const total = r.verifierPassCount + r.verifierRejectCount;
      const passRate = total > 0 ? r.verifierPassCount / total : 0;
      const avgConfidence =
        r.confidenceCount > 0 ? r.confidenceSum / r.confidenceCount : 0;
      return {
        host: r.host,
        passes: r.verifierPassCount,
        rejects: r.verifierRejectCount,
        deadCount: r.deadCount,
        staleRejectCount: r.staleRejectCount,
        offTopicRejectCount: r.offTopicRejectCount,
        dupRejectCount: r.dupRejectCount,
        passRate: Number(passRate.toFixed(3)),
        avgConfidence: Number(avgConfidence.toFixed(2)),
      };
    });

    const topPassHosts = [...enriched]
      .filter((r) => r.passes >= 2)
      .sort((a, b) => b.passes - a.passes || b.passRate - a.passRate)
      .slice(0, limit);
    const topRejectHosts = [...enriched]
      .filter((r) => r.rejects >= 2)
      .sort((a, b) => b.rejects - a.rejects || a.passRate - b.passRate)
      .slice(0, limit);

    const seenRows = await db
      .select({
        url: seenAlertsTable.url,
      })
      .from(seenAlertsTable)
      .where(sql`${seenAlertsTable.url} is not null`)
      .orderBy(desc(seenAlertsTable.seenAt))
      .limit(2000);
    const seenHostCounts = new Map<string, number>();
    for (const r of seenRows) {
      if (!r.url) continue;
      try {
        const host = new URL(r.url).host;
        seenHostCounts.set(host, (seenHostCounts.get(host) ?? 0) + 1);
      } catch {
        // skip
      }
    }
    const recentSeenHosts = Array.from(seenHostCounts.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const deadEntries = await getRecentBlacklistedEntries(limit);
    const deadHostCounts = new Map<string, number>();
    for (const e of deadEntries) {
      try {
        const host = new URL(e.url).host;
        deadHostCounts.set(host, (deadHostCounts.get(host) ?? 0) + 1);
      } catch {
        // skip
      }
    }
    const recentDeadHosts = Array.from(deadHostCounts.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const totalChecked = totalPass + totalReject;
    res.json({
      overall: {
        passRate: totalChecked > 0 ? Number((totalPass / totalChecked).toFixed(3)) : 0,
        avgConfidence:
          totalConfCount > 0 ? Number((totalConfSum / totalConfCount).toFixed(2)) : 0,
        totalChecked,
        totalPass,
        totalReject,
      },
      topPassHosts,
      topRejectHosts,
      deadUrl: {
        blacklistSize: getBlacklistSize(),
        recentDeadHosts,
      },
      recentSeenHosts,
    });
  } catch (err) {
    req.log.warn({ err }, "[admin] verifier-stats failed");
    res.status(500).json({ error: "verifier-stats failed" });
  }
});

export default router;
