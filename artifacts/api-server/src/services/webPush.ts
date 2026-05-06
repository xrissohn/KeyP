import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, webPushSubscriptionsTable } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Web Push (browser/PWA) sender. Uses VAPID for the cryptographic identity
 * of this server so push services (FCM, Mozilla autopush, Apple) accept the
 * delivery. Keys are generated once and stored as env vars; without them we
 * fail open (no push sent, just a warning) so a missing config never breaks
 * the rest of the agent pipeline.
 */
const PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"] ?? "";
const PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"] ?? "";
const SUBJECT = process.env["VAPID_SUBJECT"] ?? "mailto:noreply@keyp.app";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    logger.warn("[webPush] VAPID keys missing — web push disabled");
    return false;
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string {
  return PUBLIC_KEY;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string | null;
  /** Tag groups notifications so a follow-up replaces (not stacks) the prior one. */
  tag?: string;
  /** App badge count after this push lands. */
  badge?: number;
  /** Forwarded to the SW notificationclick handler. */
  data?: Record<string, unknown>;
}

/**
 * Dispatch one Web Push payload to every subscription registered for a
 * given KeyP deviceId (a user can install the PWA on phone + desktop).
 * 404/410 responses from the push service mean the subscription is gone —
 * we evict those rows so the table doesn't accumulate dead endpoints.
 */
export async function sendWebPushToDevice(
  deviceId: string,
  payload: WebPushPayload,
): Promise<{ sent: number; evicted: number }> {
  if (!ensureConfigured()) return { sent: 0, evicted: 0 };
  const subs = await db
    .select()
    .from(webPushSubscriptionsTable)
    .where(eq(webPushSubscriptionsTable.deviceId, deviceId));
  if (subs.length === 0) return { sent: 0, evicted: 0 };

  const json = JSON.stringify(payload);
  let sent = 0;
  let evicted = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db
            .delete(webPushSubscriptionsTable)
            .where(eq(webPushSubscriptionsTable.endpoint, s.endpoint));
          evicted += 1;
        } else {
          logger.warn(
            { err, status, endpoint: s.endpoint.slice(0, 60) },
            "[webPush] send failed",
          );
        }
      }
    }),
  );
  return { sent, evicted };
}
