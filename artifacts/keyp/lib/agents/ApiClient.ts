import type {
  AlertData,
  GeneratedAlertsResult,
  InterestSpecData,
  ParsedInterestResult,
} from '@workspace/api-client-react';

// ───────────────────────── Clerk auth-token plumbing ─────────────────────────
// AuthContext registers Clerk's `getToken` here on mount so the API client
// can attach `Authorization: Bearer <session>` to admin-gated endpoints
// (and to /agents/generate-alerts so the server can detect admin status and
// bypass the daily quota for admin users).
type TokenProvider = () => Promise<string | null>;
let clerkTokenProvider: TokenProvider | null = null;
export function setClerkTokenProvider(fn: TokenProvider | null): void {
  clerkTokenProvider = fn;
}
async function authHeaders(): Promise<Record<string, string>> {
  if (!clerkTokenProvider) return {};
  try {
    const tok = await clerkTokenProvider();
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  } catch {
    return {};
  }
}

function getApiBase(): string {
  const domain =
    process.env.EXPO_PUBLIC_DOMAIN ||
    (typeof window !== 'undefined' ? window.location.host : '');
  if (!domain) return '';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return `${domain.replace(/\/$/, '')}/api`;
  }
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    domain.includes('localhost')
  ) {
    return `http://${domain}/api`;
  }
  return `https://${domain}/api`;
}

// Build a click-safe URL that routes the user through our /api/redirect
// proxy. The proxy re-checks reachability + soft-404 at click time and falls
// back to a Google search for `fallbackQuery` if the destination is dead.
// Returns the raw URL unchanged when no API base is available (e.g. SSR /
// missing EXPO_PUBLIC_DOMAIN) so the user still gets *something* clickable.
export function buildSafeOpenUrl(
  destinationUrl: string | undefined | null,
  fallbackQuery: string,
): string | undefined {
  const q = fallbackQuery.trim();
  const googleFallback = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
    : undefined;
  if (!destinationUrl) return googleFallback;
  const base = getApiBase();
  // Fail CLOSED: if we can't reach our /api/redirect proxy we must NOT
  // hand the raw (possibly dead) URL to the user. Drop them onto a Google
  // search for the topic instead so they always land somewhere useful.
  if (!base) return googleFallback ?? destinationUrl;
  const params = new URLSearchParams({ u: destinationUrl });
  if (q) params.set('q', q);
  return `${base}/redirect?${params.toString()}`;
}

// Sentinel error used so callers can branch on timeout if they care, while
// the error message itself stays human-readable for logs/LogBox.
class ApiTimeoutError extends Error {
  readonly isTimeout = true;
  constructor(path: string, ms: number) {
    super(`API ${path} timed out after ${ms}ms`);
    this.name = 'ApiTimeoutError';
  }
}

function isAbortLike(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string };
  if (e.name === 'AbortError') return true;
  const msg = e.message ?? '';
  return /aborted|abort/i.test(msg) && /reason|signal/i.test(msg);
}

async function postJson<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const base = getApiBase();
  if (!base) throw new Error('API base URL unavailable');

  const controller = new AbortController();
  let timedOut = false;
  // Pass an explicit reason so the resulting DOMException has a meaningful
  // message instead of the opaque "signal is aborted without reason".
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      // Some runtimes (older RN/Hermes) don't accept a reason arg — fall
      // back to the no-arg form. Either way, the `timedOut` flag below is
      // the source of truth.
      (controller as AbortController & { abort: (reason?: unknown) => void }).abort(
        new Error(`KeyP request timeout (${path})`),
      );
    } catch {
      controller.abort();
    }
  }, timeoutMs);

  try {
    // Attach a SYNCHRONOUS .catch to the fetch promise so the rejection is
    // never observed as "unhandled" by the host runtime — both web (browser
    // extensions hijacking fetch) and React Native (LogBox surfacing
    // possibly-unhandled rejections) are otherwise prone to popping a red
    // overlay even when the outer await would catch it.
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).catch((err: unknown) => {
      if (timedOut || isAbortLike(err)) {
        throw new ApiTimeoutError(path, timeoutMs);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network request failed for ${path}: ${msg}`);
    });
    if (!res.ok) {
      throw new Error(`API ${path} failed with ${res.status}`);
    }
    // Body parsing can also be aborted if the timer fires mid-stream; wrap
    // it so we surface the same clean ApiTimeoutError instead of leaking a
    // raw DOMException.
    try {
      return (await res.json()) as T;
    } catch (err) {
      if (timedOut || isAbortLike(err)) {
        throw new ApiTimeoutError(path, timeoutMs);
      }
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

export { ApiTimeoutError };

export async function callParseInterest(
  rawText: string,
  userId?: string
): Promise<ParsedInterestResult> {
  return postJson<ParsedInterestResult>('/agents/parse-interest', { rawText, userId });
}

export class PlanLimitError extends Error {
  readonly isPlanLimit = true;
  readonly status = 403;
  readonly plan: PlanTier;
  readonly used: number;
  readonly limit: number;
  constructor(opts: { plan: PlanTier; used: number; limit: number; message?: string }) {
    super(opts.message ?? 'plan_limit');
    this.name = 'PlanLimitError';
    this.plan = opts.plan;
    this.used = opts.used;
    this.limit = opts.limit;
  }
}

export class ApiRateLimitError extends Error {
  readonly isRateLimit = true;
  readonly status = 429;
  readonly retryAfterSec?: number;
  readonly used?: number;
  readonly quota?: number;
  constructor(opts: { retryAfterSec?: number; used?: number; quota?: number; message?: string }) {
    super(opts.message ?? 'rate_limited');
    this.name = 'ApiRateLimitError';
    this.retryAfterSec = opts.retryAfterSec;
    this.used = opts.used;
    this.quota = opts.quota;
  }
}

export async function callGenerateAlerts(
  spec: InterestSpecData,
  count = 3,
  existingAlertSummaries: { title: string; summary: string }[] = [],
  deviceId?: string,
  plan?: PlanTier,
  userLanguage?: 'ko' | 'en',
  /**
   * ISO timestamp of the most-recent already-delivered alert's underlying
   * event for this interest. Server uses it as a HARD freshness floor:
   * any candidate whose underlying event happened earlier than this is
   * rejected at multiple stages. Sniffed off raw body server-side (no
   * codegen ripple) — see /agents/generate-alerts handler.
   */
  latestKnownEventAt?: string,
  /**
   * Stable interest identifier so the server can apply per-interest source
   * preferences (block/boost) and per-device daily quota tracking. Sniffed
   * off raw body server-side (no codegen ripple).
   */
  interestId?: string,
): Promise<GeneratedAlertsResult> {
  const base = getApiBase();
  if (!base) throw new Error('API base URL unavailable');
  // We hand-roll the fetch here (instead of postJson) because we need to
  // surface 429 quota responses as a typed error so the UI can show a
  // friendly toast — postJson treats every non-2xx as a generic Error.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const auth = await authHeaders();
    const res = await fetch(`${base}/agents/generate-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      credentials: 'include',
      body: JSON.stringify({
        spec,
        count,
        existingAlertSummaries,
        ...(deviceId ? { deviceId } : {}),
        ...(plan ? { plan } : {}),
        ...(userLanguage ? { userLanguage } : {}),
        ...(latestKnownEventAt ? { latestKnownEventAt } : {}),
        ...(interestId ? { interestId } : {}),
      }),
      signal: controller.signal,
    });
    if (res.status === 429) {
      // Server returns `{ used, limit, remaining }`; we accept `quota` too as
      // a forward-compatible alias so future protocol tweaks don't silently
      // strand the toast UI on `?` placeholders.
      let body: {
        used?: number;
        limit?: number;
        quota?: number;
        retryAfterSec?: number;
      } = {};
      try {
        body = await res.json();
      } catch {}
      const ra = parseInt(res.headers.get('retry-after') ?? '', 10);
      throw new ApiRateLimitError({
        retryAfterSec: Number.isFinite(ra) ? ra : body.retryAfterSec,
        used: body.used,
        quota: body.quota ?? body.limit,
      });
    }
    if (!res.ok) {
      throw new Error(`API /agents/generate-alerts failed with ${res.status}`);
    }
    return (await res.json()) as GeneratedAlertsResult;
  } finally {
    clearTimeout(timer);
  }
}

// ───────────────────────── Beta feedback / reports ─────────────────────────

export async function callFeedbackReport(args: {
  deviceId: string;
  alertId?: string;
  interestId?: string;
  kind?: 'feedback' | 'abuse' | 'bug' | 'other';
  body: string;
  contact?: string;
}): Promise<{ ok: boolean }> {
  try {
    return await postJson<{ ok: boolean }>('/feedback/report', args, 10000);
  } catch (err) {
    console.warn('[KeyP] callFeedbackReport failed:', err);
    return { ok: false };
  }
}

// ───────────────────────── Discovery (trending) ─────────────────────────

export interface TrendingInterestItem {
  label: string;
  count: number;
}

export async function callTrendingInterests(): Promise<TrendingInterestItem[]> {
  const base = getApiBase();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/discover/trending-interests`);
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: TrendingInterestItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

// ───────────────────────── Source preferences (per-interest) ─────────────

export interface SourceStatItem {
  host: string;
  count: number;
  mode: 'block' | 'boost' | null;
}

export async function callSourceStats(
  interestId: string,
  deviceId: string,
): Promise<SourceStatItem[]> {
  const base = getApiBase();
  if (!base || !deviceId) return [];
  try {
    const url =
      `${base}/interests/${encodeURIComponent(interestId)}/source-stats` +
      `?deviceId=${encodeURIComponent(deviceId)}`;
    const res = await fetch(url, {
      headers: { 'x-device-id': deviceId },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: SourceStatItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function callSetSourcePref(args: {
  interestId: string;
  deviceId: string;
  host: string;
  mode: 'block' | 'boost' | 'clear';
}): Promise<{ ok: boolean }> {
  const base = getApiBase();
  if (!base || !args.deviceId) return { ok: false };
  try {
    const res = await fetch(
      `${base}/interests/${encodeURIComponent(args.interestId)}/source-pref`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': args.deviceId,
        },
        body: JSON.stringify({
          host: args.host,
          mode: args.mode,
          deviceId: args.deviceId,
        }),
      },
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// Best-effort feedback ping. Never throws — we don't want a network blip to
// surface as an error in the UI when the user just tapped 좋아요/싫어요.
export async function callFeedback(args: {
  deviceId: string;
  alertId: string;
  interestId?: string;
  title: string;
  summary: string;
  sourceType?: string;
  sourceName?: string;
  tags?: string[];
  feedback: 'like' | 'dislike' | 'more' | 'hide';
}): Promise<{ ok: boolean }> {
  try {
    return await postJson<{ ok: boolean }>('/push/feedback', args, 8000);
  } catch (err) {
    console.warn('[KeyP] callFeedback failed (best-effort):', err);
    return { ok: false };
  }
}

// ───────────────────────── Push (server-side tracking) ─────────────────────

export async function callRegisterDevice(args: {
  deviceId: string;
  expoPushToken: string;
  platform: 'ios' | 'android' | 'web';
}): Promise<{ ok: boolean }> {
  return postJson('/push/register-device', args, 10000);
}

export async function callTrackInterest(args: {
  interestId: string;
  deviceId: string;
  spec: InterestSpecData;
  rawText?: string;
  userLanguage?: 'ko' | 'en';
}): Promise<{ ok: boolean; interestId: string }> {
  // Hand-rolled (instead of postJson) so we can map a 403 PLAN_LIMIT
  // response to the typed `PlanLimitError` the UI surfaces as a friendly
  // "한도 도달" message — postJson would collapse it into a generic Error.
  const base = getApiBase();
  if (!base) throw new Error('API base URL unavailable');
  const auth = await authHeaders();
  const res = await fetch(`${base}/push/track-interest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    credentials: 'include',
    body: JSON.stringify(args),
  });
  if (res.status === 403) {
    let body: { code?: string; plan?: PlanTier; used?: number; limit?: number } = {};
    try { body = await res.json(); } catch {}
    if (body.code === 'PLAN_LIMIT') {
      throw new PlanLimitError({
        plan: body.plan ?? 'free',
        used: body.used ?? 0,
        limit: body.limit ?? 3,
      });
    }
    throw new Error(`API /push/track-interest failed with 403`);
  }
  if (!res.ok) {
    throw new Error(`API /push/track-interest failed with ${res.status}`);
  }
  return (await res.json()) as { ok: boolean; interestId: string };
}

export async function callUntrackInterest(interestId: string): Promise<{ ok: boolean }> {
  const base = getApiBase();
  if (!base) return { ok: false };
  const res = await fetch(`${base}/push/track-interest/${encodeURIComponent(interestId)}`, {
    method: 'DELETE',
  });
  return { ok: res.ok };
}

export async function callPushTest(deviceId: string): Promise<{ ok: boolean; ticket: string }> {
  return postJson('/push/test', { deviceId }, 15000);
}

export type PlanTier = 'free' | 'basic' | 'pro' | 'power';

export async function callSetPlan(args: {
  deviceId: string;
  plan: PlanTier;
}): Promise<{
  ok: boolean;
  plan: PlanTier;
  updatedCount: number;
  interestCap: number;
  boost: { used: number; quota: number; remaining: number };
}> {
  return postJson('/push/set-plan', args, 10000);
}

export async function callBoost(args: {
  deviceId: string;
  interestId: string;
}): Promise<{
  ok: boolean;
  reason?: string;
  used: number;
  quota: number;
  remaining: number;
}> {
  const base = getApiBase();
  if (!base) throw new Error('API base URL unavailable');
  const res = await fetch(`${base}/push/boost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  // 403/404 still carry a meaningful body (quota_exceeded etc.) — surface it.
  return (await res.json()) as Awaited<ReturnType<typeof callBoost>>;
}

// ───────────────────────── Admin dashboard ─────────────────────────

export interface AdminMe {
  isAdmin: boolean;
  email: string | null;
  via: 'token' | 'clerk' | 'none';
}

export async function callAdminMe(): Promise<AdminMe> {
  const base = getApiBase();
  if (!base) return { isAdmin: false, email: null, via: 'none' };
  try {
    const auth = await authHeaders();
    const res = await fetch(`${base}/admin/me`, {
      headers: { ...auth },
      credentials: 'include',
    });
    if (!res.ok) return { isAdmin: false, email: null, via: 'none' };
    return (await res.json()) as AdminMe;
  } catch {
    return { isAdmin: false, email: null, via: 'none' };
  }
}

export interface AdminStats {
  pushDevices: number;
  trackedInterests: number;
  seenAlerts: number;
  blacklist: { size: number; recent: { host: string; reason: string; ts: number }[] };
}

export async function callAdminStats(): Promise<AdminStats | null> {
  const base = getApiBase();
  if (!base) return null;
  try {
    const auth = await authHeaders();
    const res = await fetch(`${base}/admin/stats`, {
      headers: { ...auth },
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminStats;
  } catch {
    return null;
  }
}

export interface AdminVerifierStats {
  overall: {
    passRate: number;
    avgConfidence: number;
    totalChecked: number;
    totalPass: number;
    totalReject: number;
  };
  topPassHosts: { host: string; passes: number; rejects: number; passRate: number; avgConfidence: number }[];
  topRejectHosts: { host: string; passes: number; rejects: number; passRate: number; avgConfidence: number }[];
  deadUrl: { blacklistSize: number; recentDeadHosts: { host: string; count: number }[] };
  recentSeenHosts: { host: string; count: number }[];
}

export async function callAdminVerifierStats(): Promise<AdminVerifierStats | null> {
  const base = getApiBase();
  if (!base) return null;
  try {
    const auth = await authHeaders();
    const res = await fetch(`${base}/admin/verifier-stats`, {
      headers: { ...auth },
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminVerifierStats;
  } catch {
    return null;
  }
}

export type { AlertData, InterestSpecData, ParsedInterestResult, GeneratedAlertsResult };
