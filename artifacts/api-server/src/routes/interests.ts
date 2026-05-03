import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  seenAlertsTable,
  sourcePreferencesTable,
  trackedInterestsTable,
} from "@workspace/db";
import { and, eq, sql, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

/**
 * Resolve and authorize the (deviceId, interestId) pair before any
 * source-preference read/write. Without this, an attacker could enumerate
 * or mutate any tracked interest's preferences just by guessing IDs (IDOR).
 *
 * deviceId may come from the query string (GET) or body (POST); both paths
 * are accepted. We require an exact match against the row's owner.
 *
 * Returns false when access is denied; the caller should `return` immediately
 * because this helper has already written the HTTP response.
 */
async function authorizeInterestAccess(
  req: Request,
  res: Response,
  interestId: string,
): Promise<boolean> {
  const headerDevice = req.header("x-device-id");
  const queryDevice =
    typeof req.query.deviceId === "string" ? req.query.deviceId : undefined;
  const bodyDevice =
    req.body && typeof req.body === "object" && typeof (req.body as Record<string, unknown>).deviceId === "string"
      ? ((req.body as Record<string, unknown>).deviceId as string)
      : undefined;
  const deviceId = (headerDevice ?? queryDevice ?? bodyDevice ?? "").trim();
  if (!deviceId) {
    res.status(401).json({ error: "missing_device_id" });
    return false;
  }
  const rows = await db
    .select({ deviceId: trackedInterestsTable.deviceId })
    .from(trackedInterestsTable)
    .where(eq(trackedInterestsTable.interestId, interestId))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "interest_not_found" });
    return false;
  }
  if (rows[0].deviceId !== deviceId) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

function safeHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

// GET /interests/:id/source-stats — per-host counts of items already seen
// for this interest. Powers the "소스 관리" UI so users can decide which
// hosts to block or boost.
router.get("/interests/:id/source-stats", async (req, res) => {
  const interestId = req.params.id;
  if (!interestId || interestId.length > 128) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  if (!(await authorizeInterestAccess(req, res, interestId))) return;
  try {
    const rows = await db
      .select({ url: seenAlertsTable.url })
      .from(seenAlertsTable)
      .where(eq(seenAlertsTable.interestId, interestId))
      .orderBy(desc(seenAlertsTable.seenAt))
      .limit(500);
    const counts = new Map<string, number>();
    for (const r of rows) {
      const h = safeHost(r.url);
      if (!h) continue;
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const prefs = await db
      .select()
      .from(sourcePreferencesTable)
      .where(eq(sourcePreferencesTable.interestId, interestId));
    const prefMap = new Map(prefs.map((p) => [p.host, p.mode]));
    const items = [...counts.entries()]
      .map(([host, count]) => ({
        host,
        count,
        mode: (prefMap.get(host) as "block" | "boost" | undefined) ?? null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    // Also surface any explicitly-managed hosts that haven't appeared in
    // recent seen-alerts (e.g. a host the user pre-blocked).
    for (const p of prefs) {
      if (!counts.has(p.host)) {
        items.push({ host: p.host, count: 0, mode: p.mode as "block" | "boost" });
      }
    }
    res.json({ interestId, items });
  } catch (err) {
    req.log.warn({ err, interestId }, "[interests] source-stats failed");
    res.status(500).json({ error: "stats_failed" });
  }
});

const PrefBody = z.object({
  host: z.string().min(1).max(253),
  mode: z.enum(["block", "boost", "clear"]),
});

router.post("/interests/:id/source-pref", async (req, res) => {
  const interestId = req.params.id;
  if (!interestId || interestId.length > 128) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  if (!(await authorizeInterestAccess(req, res, interestId))) return;
  const parsed = PrefBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }
  const host = parsed.data.host.toLowerCase().trim();
  const mode = parsed.data.mode;
  try {
    if (mode === "clear") {
      await db
        .delete(sourcePreferencesTable)
        .where(
          and(
            eq(sourcePreferencesTable.interestId, interestId),
            eq(sourcePreferencesTable.host, host),
          ),
        );
    } else {
      await db
        .insert(sourcePreferencesTable)
        .values({ interestId, host, mode })
        .onConflictDoUpdate({
          target: [sourcePreferencesTable.interestId, sourcePreferencesTable.host],
          set: { mode, createdAt: sql`now()` },
        });
    }
    res.json({ ok: true, interestId, host, mode });
  } catch (err) {
    req.log.warn({ err, interestId, host, mode }, "[interests] source-pref upsert failed");
    res.status(500).json({ error: "upsert_failed" });
  }
});

export default router;
