import type { Request } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { logger } from "./logger";

const DEFAULT_ADMIN_EMAILS = ["xrissohn@xrisp.com"];

function loadAdminEmails(): Set<string> {
  const fromEnv = (process.env["ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set<string>([
    ...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...fromEnv,
  ]);
}

const ADMIN_EMAILS = loadAdminEmails();

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}

export function listAdminEmails(): string[] {
  return Array.from(ADMIN_EMAILS);
}

interface AdminContext {
  isAdmin: boolean;
  email: string | null;
  userId: string | null;
  via: "token" | "clerk" | "none";
}

const cache = new Map<string, { isAdmin: boolean; email: string | null; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolve the admin context for a request.
 *
 * Two acceptance paths:
 *  1. Legacy ops token via `x-admin-token` header (matches `ADMIN_TOKEN` env).
 *  2. Clerk-authenticated user whose primary email is in ADMIN_EMAILS.
 *
 * Result is cached by Clerk userId for 5 minutes to avoid hammering the
 * Clerk API on every quota check.
 */
export async function getAdminContext(req: Request): Promise<AdminContext> {
  const adminToken = process.env["ADMIN_TOKEN"];
  if (adminToken && req.header("x-admin-token") === adminToken) {
    return { isAdmin: true, email: null, userId: null, via: "token" };
  }

  let userId: string | null = null;
  try {
    const auth = getAuth(req);
    userId = auth?.userId ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return { isAdmin: false, email: null, userId: null, via: "none" };
  }

  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return {
      isAdmin: hit.isAdmin,
      email: hit.email,
      userId,
      via: hit.isAdmin ? "clerk" : "none",
    };
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    const isAdmin = isAdminEmail(email);
    cache.set(userId, { isAdmin, email, ts: now });
    return { isAdmin, email, userId, via: isAdmin ? "clerk" : "none" };
  } catch (err) {
    logger.warn({ err, userId }, "[adminAuth] clerk user lookup failed");
    return { isAdmin: false, email: null, userId, via: "none" };
  }
}
