import { logger } from "../lib/logger";

// Expo push notifications are dispatched through Expo's hosted push service.
// No SDK needed — a single POST with up to 100 messages per call. Tokens that
// come back as DeviceNotRegistered should be evicted by the caller so future
// sweeps stop sending to dead devices.
//
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushSendResult {
  tickets: ExpoPushTicket[];
  invalidTokens: string[];
}

export function isExpoPushToken(token: string): boolean {
  return /^Expo(?:nent)?PushToken\[[^\]]+\]$/.test(token);
}

export async function sendExpoPush(
  messages: ExpoPushMessage[],
): Promise<ExpoPushSendResult> {
  if (messages.length === 0) {
    return { tickets: [], invalidTokens: [] };
  }
  // Drop messages with malformed tokens up front so a single bad row doesn't
  // poison the whole batch.
  const valid: ExpoPushMessage[] = [];
  const invalidTokens: string[] = [];
  for (const m of messages) {
    if (isExpoPushToken(m.to)) valid.push(m);
    else invalidTokens.push(m.to);
  }
  if (valid.length === 0) {
    return { tickets: [], invalidTokens };
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify(valid),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status, statusText: res.statusText },
        "[expoPush] non-2xx from Expo push service",
      );
      return { tickets: [], invalidTokens };
    }
    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    const tickets = Array.isArray(json.data) ? json.data : [];
    // Expo signals dead devices via ticket.details.error === "DeviceNotRegistered"
    tickets.forEach((t, i) => {
      if (
        t.status === "error" &&
        t.details?.error === "DeviceNotRegistered" &&
        valid[i]
      ) {
        invalidTokens.push(valid[i]!.to);
      }
    });
    return { tickets, invalidTokens };
  } catch (err) {
    logger.error({ err }, "[expoPush] dispatch failed");
    return { tickets: [], invalidTokens };
  }
}
