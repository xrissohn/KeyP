import { randomBytes } from "node:crypto";
import type { Request } from "express";

/**
 * Internal-loopback shared secret. Generated once per process at boot and
 * never persisted. The in-process cron caller (`pollerCron.callGenerateAlerts`)
 * sends it as `x-internal-token`; the `/agents/generate-alerts` route uses it
 * to decide whether a request without `deviceId` is a trusted server-internal
 * sweep (allowed to bypass the per-device daily quota) or an external client
 * trying to evade rate limiting.
 *
 * Because the secret is regenerated every boot and only lives in memory, it
 * never leaves this process — there's nothing to rotate, nothing to leak.
 */
export const INTERNAL_TOKEN = randomBytes(32).toString("hex");

export function isInternalLoopback(req: Request): boolean {
  const tok = req.header("x-internal-token");
  return typeof tok === "string" && tok.length > 0 && tok === INTERNAL_TOKEN;
}
