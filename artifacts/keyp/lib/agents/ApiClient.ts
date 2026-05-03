import type {
  AlertData,
  GeneratedAlertsResult,
  InterestSpecData,
  ParsedInterestResult,
} from '@workspace/api-client-react';

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

async function postJson<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const base = getApiBase();
  if (!base) throw new Error('API base URL unavailable');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Attach a SYNCHRONOUS .catch to the fetch promise so the rejection is
    // never observed as "unhandled" by the host runtime. Some browser
    // extensions hijack fetch and surface the rejection in a microtask BEFORE
    // the surrounding async/await chain has had a chance to wire up its
    // handlers — that's what causes the "Uncaught Error: Failed to fetch"
    // overlay in Expo Web's LogBox even though our outer try/catch would
    // otherwise swallow it. The synchronous .catch defuses that race.
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network request failed for ${path}: ${msg}`);
    });
    if (!res.ok) {
      throw new Error(`API ${path} failed with ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function callParseInterest(
  rawText: string,
  userId?: string
): Promise<ParsedInterestResult> {
  return postJson<ParsedInterestResult>('/agents/parse-interest', { rawText, userId });
}

export async function callGenerateAlerts(
  spec: InterestSpecData,
  count = 3,
  existingAlertSummaries: { title: string; summary: string }[] = [],
  deviceId?: string,
  plan?: PlanTier,
  userLanguage?: 'ko' | 'en'
): Promise<GeneratedAlertsResult> {
  return postJson<GeneratedAlertsResult>(
    '/agents/generate-alerts',
    {
      spec,
      count,
      existingAlertSummaries,
      ...(deviceId ? { deviceId } : {}),
      ...(plan ? { plan } : {}),
      ...(userLanguage ? { userLanguage } : {}),
    },
    45000
  );
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
  return postJson('/push/track-interest', args, 10000);
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

export type { AlertData, InterestSpecData, ParsedInterestResult, GeneratedAlertsResult };
