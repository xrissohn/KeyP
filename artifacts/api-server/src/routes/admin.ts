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

const router: IRouter = Router();

/**
 * Shared admin token gate. Returns true when the request is authorized.
 * - When ADMIN_TOKEN is set, require an exact `x-admin-token` header match.
 * - When unset, allow in non-production (dev/preview) and 404 in prod so the
 *   route's existence isn't even hinted at without a token.
 */
function checkAdmin(req: Request, res: Response): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "not found" });
      return false;
    }
    return true;
  }
  if (req.header("x-admin-token") !== adminToken) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

// Read-only observability endpoint. Counts only — no PII payloads.
// Intended for development/debugging; in production you'd gate this behind
// an admin token or remove it entirely.
// Token gate: when ADMIN_TOKEN is set, require `x-admin-token` header to match.
// When unset, the route is disabled in production-like environments and returns 404.
router.get("/admin/stats", async (req, res) => {
  if (!checkAdmin(req, res)) return;
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
 * Verifier operations dashboard (JSON only — no in-app UI yet).
 *
 * Aggregates the source-reputation table (which the Verifier writes to on
 * every pass/reject) plus a quick host-frequency scan over the dedup table
 * so we can spot which domains dominate KeyP's recent output.
 *
 * Response shape:
 *   {
 *     overall: { passRate, avgConfidence, totalChecked },
 *     topPassHosts: [{ host, passes, rejects, passRate, avgConfidence }],
 *     topRejectHosts: [...],
 *     deadUrl: { blacklistSize, recentDeadHosts: [...] },
 *     recentSeenHosts: [{ host, count }],
 *   }
 */
router.get("/admin/verifier-stats", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const limit = Math.max(
      1,
      Math.min(50, parseInt(String(req.query.limit ?? ""), 10) || 20),
    );

    // Aggregate over the global reputation row (deviceId = "__global__") —
    // these are the system-wide Verifier outcomes accumulated across users.
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

    // Sort by activity volume to pick the most informative top-N — sorting
    // by raw passRate would surface 1-of-1 noise hosts at the top.
    const topPassHosts = [...enriched]
      .filter((r) => r.passes >= 2)
      .sort((a, b) => b.passes - a.passes || b.passRate - a.passRate)
      .slice(0, limit);
    const topRejectHosts = [...enriched]
      .filter((r) => r.rejects >= 2)
      .sort((a, b) => b.rejects - a.rejects || a.passRate - b.passRate)
      .slice(0, limit);

    // Recent dedup activity by host — derived from seenAlertsTable URLs by
    // extracting the host at query time (no host column on the table).
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
        // skip invalid URL
      }
    }
    const recentSeenHosts = Array.from(seenHostCounts.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Dead-URL summary
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
