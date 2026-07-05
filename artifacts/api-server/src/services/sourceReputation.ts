import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  sourceReputationTable,
  GLOBAL_DEVICE_ID,
  type SourceReputation,
} from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Host extraction ────────────────────────────────────────────────────
export function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return null;
  }
}

// ─── Reject-reason classification (Korean keyword heuristics) ───────────
export type RejectClass = "stale" | "offTopic" | "dup" | "other";

export function classifyRejectReason(reason: string | undefined | null): RejectClass {
  if (!reason) return "other";
  const r = reason.toLowerCase();
  // Korean + English keywords
  if (
    r.includes("stale") ||
    r.includes("오래") ||
    r.includes("재게시") ||
    r.includes("재발행") ||
    r.includes("repost") ||
    r.includes("republish") ||
    r.includes("신선도") ||
    r.includes("freshness") ||
    r.includes("일 전") ||
    r.includes("개월") ||
    r.includes("일전")
  ) {
    return "stale";
  }
  if (
    r.includes("dup") ||
    r.includes("중복") ||
    r.includes("동일") ||
    r.includes("duplicate")
  ) {
    return "dup";
  }
  if (
    r.includes("off-topic") ||
    r.includes("off topic") ||
    r.includes("주제") ||
    r.includes("관련 없") ||
    r.includes("위배") ||
    r.includes("부적합") ||
    r.includes("거리가 멀") ||
    r.includes("일반") ||
    r.includes("해외") ||
    r.includes("국내")
  ) {
    return "offTopic";
  }
  return "other";
}

// ─── Bump deltas (UPSERT) ───────────────────────────────────────────────
export interface ReputationDelta {
  likes?: number;
  dislikes?: number;
  moreCount?: number;
  hideCount?: number;
  deadCount?: number;
  verifierPassCount?: number;
  verifierRejectCount?: number;
  staleRejectCount?: number;
  offTopicRejectCount?: number;
  dupRejectCount?: number;
  confidenceSum?: number;
  confidenceCount?: number;
}

const FIELD_KEYS = [
  "likes",
  "dislikes",
  "moreCount",
  "hideCount",
  "deadCount",
  "verifierPassCount",
  "verifierRejectCount",
  "staleRejectCount",
  "offTopicRejectCount",
  "dupRejectCount",
  "confidenceSum",
  "confidenceCount",
] as const satisfies readonly (keyof ReputationDelta)[];

const FIELD_TO_COLUMN: Record<keyof ReputationDelta, string> = {
  likes: "likes",
  dislikes: "dislikes",
  moreCount: "more_count",
  hideCount: "hide_count",
  deadCount: "dead_count",
  verifierPassCount: "verifier_pass_count",
  verifierRejectCount: "verifier_reject_count",
  staleRejectCount: "stale_reject_count",
  offTopicRejectCount: "off_topic_reject_count",
  dupRejectCount: "dup_reject_count",
  confidenceSum: "confidence_sum",
  confidenceCount: "confidence_count",
};

async function bumpOne(host: string, deviceId: string, delta: ReputationDelta): Promise<void> {
  const insertCols: string[] = ["host", "device_id"];
  const insertVals: (string | number)[] = [host, deviceId];
  const updateAssignments: ReturnType<typeof sql.raw>[] = [sql.raw(`updated_at = now()`)];
  for (const k of FIELD_KEYS) {
    const v = delta[k];
    if (typeof v === "number" && v !== 0) {
      const col = FIELD_TO_COLUMN[k];
      insertCols.push(col);
      insertVals.push(v);
      updateAssignments.push(
        sql.raw(`${col} = source_reputation.${col} + EXCLUDED.${col}`),
      );
    }
  }
  if (updateAssignments.length === 1) return; // only updated_at = nothing meaningful to bump
  const colsSql = sql.raw(insertCols.join(", "));
  const valsSql = sql.join(
    insertVals.map((v) => sql`${v}`),
    sql.raw(", "),
  );
  const updateSql = sql.join(updateAssignments, sql.raw(", "));
  try {
    await db.execute(
      sql`INSERT INTO source_reputation (${colsSql}) VALUES (${valsSql}) ON CONFLICT (host, device_id) DO UPDATE SET ${updateSql}`,
    );
  } catch (err) {
    logger.warn({ err, host, deviceId }, "[reputation] bump failed");
  }
}

export async function bumpReputation(
  host: string | null,
  deviceId: string | null | undefined,
  delta: ReputationDelta,
): Promise<void> {
  if (!host) return;
  // Always bump global aggregate.
  await bumpOne(host, GLOBAL_DEVICE_ID, delta);
  if (deviceId && deviceId !== GLOBAL_DEVICE_ID) {
    await bumpOne(host, deviceId, delta);
  }
}

// ─── Batch read ─────────────────────────────────────────────────────────
export interface ReputationLookup {
  global?: SourceReputation;
  device?: SourceReputation;
}

export async function getReputationForHosts(
  hosts: string[],
  deviceId: string | null | undefined,
): Promise<Map<string, ReputationLookup>> {
  const out = new Map<string, ReputationLookup>();
  const uniqueHosts = Array.from(new Set(hosts.filter((h): h is string => !!h)));
  if (uniqueHosts.length === 0) return out;
  const hostListSql = sql.join(
    uniqueHosts.map((h) => sql`${h}`),
    sql.raw(", "),
  );
  const deviceIds =
    deviceId && deviceId !== GLOBAL_DEVICE_ID
      ? [GLOBAL_DEVICE_ID, deviceId]
      : [GLOBAL_DEVICE_ID];
  const deviceListSql = sql.join(
    deviceIds.map((d) => sql`${d}`),
    sql.raw(", "),
  );
  try {
    const result = await db.execute(
      sql`SELECT host, device_id, likes, dislikes, more_count, hide_count, dead_count,
                 verifier_pass_count, verifier_reject_count, stale_reject_count,
                 off_topic_reject_count, dup_reject_count, confidence_sum, confidence_count,
                 updated_at
          FROM source_reputation
          WHERE host IN (${hostListSql}) AND device_id IN (${deviceListSql})`,
    );
    type Row = {
      host: string;
      device_id: string;
      likes: number;
      dislikes: number;
      more_count: number;
      hide_count: number;
      dead_count: number;
      verifier_pass_count: number;
      verifier_reject_count: number;
      stale_reject_count: number;
      off_topic_reject_count: number;
      dup_reject_count: number;
      confidence_sum: number;
      confidence_count: number;
      updated_at: Date;
    };
    const rows = (result as unknown as { rows: Row[] }).rows ?? [];
    for (const r of rows) {
      const rep: SourceReputation = {
        host: r.host,
        deviceId: r.device_id,
        likes: Number(r.likes),
        dislikes: Number(r.dislikes),
        moreCount: Number(r.more_count),
        hideCount: Number(r.hide_count),
        deadCount: Number(r.dead_count),
        verifierPassCount: Number(r.verifier_pass_count),
        verifierRejectCount: Number(r.verifier_reject_count),
        staleRejectCount: Number(r.stale_reject_count),
        offTopicRejectCount: Number(r.off_topic_reject_count),
        dupRejectCount: Number(r.dup_reject_count),
        confidenceSum: Number(r.confidence_sum),
        confidenceCount: Number(r.confidence_count),
        updatedAt: r.updated_at,
      };
      const slot = out.get(r.host) ?? {};
      if (r.device_id === GLOBAL_DEVICE_ID) slot.global = rep;
      else slot.device = rep;
      out.set(r.host, slot);
    }
  } catch (err) {
    logger.warn({ err }, "[reputation] read failed");
  }
  return out;
}

// ─── Numeric score for Selector pre-rank (-1.0 .. +1.0 typical) ─────────
export function reputationScore(lookup: ReputationLookup | undefined): number {
  if (!lookup) return 0;
  let score = 0;
  for (const rep of [lookup.global, lookup.device]) {
    if (!rep) continue;
    const weight = rep.deviceId === GLOBAL_DEVICE_ID ? 0.4 : 1.0;
    const passRate =
      rep.verifierPassCount + rep.verifierRejectCount > 0
        ? rep.verifierPassCount /
          (rep.verifierPassCount + rep.verifierRejectCount)
        : 0.5;
    const avgConf =
      rep.confidenceCount > 0 ? rep.confidenceSum / rep.confidenceCount / 100 : 0.5;
    const explicit =
      (rep.likes + rep.moreCount * 1.5 - rep.dislikes - rep.hideCount * 1.2) /
      Math.max(5, rep.likes + rep.dislikes + rep.moreCount + rep.hideCount + 5);
    const penalty =
      (rep.deadCount * 0.15 +
        rep.staleRejectCount * 0.1 +
        rep.offTopicRejectCount * 0.05 +
        rep.dupRejectCount * 0.05) /
      10;
    score += weight * (explicit + (passRate - 0.5) * 0.6 + (avgConf - 0.5) * 0.4 - penalty);
  }
  return score;
}

// ─── Format for Verifier prompt injection ───────────────────────────────
export function formatReputationForPrompt(lookup: ReputationLookup | undefined): string {
  if (!lookup || (!lookup.global && !lookup.device)) return "";
  const parts: string[] = [];
  for (const rep of [lookup.device, lookup.global]) {
    if (!rep) continue;
    const total = rep.verifierPassCount + rep.verifierRejectCount;
    if (total === 0 && rep.likes === 0 && rep.dislikes === 0 && rep.deadCount === 0) {
      continue;
    }
    const tag = rep.deviceId === GLOBAL_DEVICE_ID ? "글로벌" : "본인";
    const avgC = rep.confidenceCount > 0 ? Math.round(rep.confidenceSum / rep.confidenceCount) : null;
    const bits: string[] = [];
    if (rep.likes > 0 || rep.dislikes > 0)
      bits.push(`like=${rep.likes}/dis=${rep.dislikes}`);
    if (total > 0)
      bits.push(`pass=${rep.verifierPassCount}/rej=${rep.verifierRejectCount}`);
    if (rep.staleRejectCount > 0) bits.push(`stale=${rep.staleRejectCount}`);
    if (rep.offTopicRejectCount > 0) bits.push(`offTopic=${rep.offTopicRejectCount}`);
    if (rep.dupRejectCount > 0) bits.push(`dup=${rep.dupRejectCount}`);
    if (rep.deadCount > 0) bits.push(`dead=${rep.deadCount}`);
    if (avgC !== null) bits.push(`avgConf=${avgC}`);
    if (bits.length > 0) parts.push(`${tag}[${bits.join(" ")}]`);
  }
  return parts.length > 0 ? parts.join(" ") : "";
}
