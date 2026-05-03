import { db, usageQuotaTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

// Daily generate-alerts quotas per plan tier. UTC day boundary.
// free/basic: 30/day; pro/power: 200/day. Rationale: a Basic user polling
// every 15min produces ~96 server-driven sweeps/day already (those are
// poller-internal, not counted here). 30 user-initiated taps gives plenty of
// headroom for manual refresh + interest-add seeds. Pro power-users may
// register up to 30 interests and want to refresh aggressively.
const PLAN_QUOTAS: Record<string, number> = {
  free: 30,
  basic: 30,
  pro: 200,
  power: 200,
};

const ENDPOINT = "generate-alerts";

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

function utcDay(): string {
  // YYYY-MM-DD in UTC. Matches the Postgres `date` column format exactly.
  return new Date().toISOString().slice(0, 10);
}

export function quotaForPlan(plan: string | undefined | null): number {
  return PLAN_QUOTAS[(plan as string) ?? "free"] ?? PLAN_QUOTAS["free"]!;
}

/**
 * Atomically reserve one unit of quota for (deviceId, today, endpoint).
 * Returns whether the call should be allowed plus current usage stats.
 *
 * If the underlying DB call fails we FAIL OPEN — the user shouldn't lose
 * service due to a counter outage. The error is logged so we notice.
 */
export async function reserveQuota(
  deviceId: string | undefined | null,
  plan: string | undefined | null,
): Promise<QuotaCheck> {
  const limit = quotaForPlan(plan);
  // No deviceId means the caller is the loopback poller / a server-internal
  // sweep — those bypass the quota since they're already cost-controlled by
  // plan-aware polling cadence.
  if (!deviceId) {
    return { allowed: true, used: 0, limit, remaining: limit };
  }
  const day = utcDay();
  try {
    // Atomic upsert: insert with count=1 if missing, else count = count + 1.
    // RETURNING gives us the post-increment value so the check is race-free.
    const rows = await db
      .insert(usageQuotaTable)
      .values({ deviceId, day, endpoint: ENDPOINT, count: 1 })
      .onConflictDoUpdate({
        target: [usageQuotaTable.deviceId, usageQuotaTable.day, usageQuotaTable.endpoint],
        set: { count: sql`${usageQuotaTable.count} + 1` },
      })
      .returning({ count: usageQuotaTable.count });
    const used = rows[0]?.count ?? 1;
    return {
      allowed: used <= limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  } catch (err) {
    logger.warn({ err, deviceId, plan }, "[rateLimit] reserve failed — failing open");
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}

/**
 * Read-only quota peek (does not increment). Useful for status endpoints.
 */
export async function peekQuota(
  deviceId: string,
  plan: string | undefined | null,
): Promise<QuotaCheck> {
  const limit = quotaForPlan(plan);
  const day = utcDay();
  try {
    const rows = await db
      .select({ count: usageQuotaTable.count })
      .from(usageQuotaTable)
      .where(
        and(
          eq(usageQuotaTable.deviceId, deviceId),
          eq(usageQuotaTable.day, day),
          eq(usageQuotaTable.endpoint, ENDPOINT),
        ),
      )
      .limit(1);
    const used = rows[0]?.count ?? 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  } catch (err) {
    logger.warn({ err, deviceId, plan }, "[rateLimit] peek failed");
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}
