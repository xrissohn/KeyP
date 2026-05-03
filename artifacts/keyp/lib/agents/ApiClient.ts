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

async function postJson<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const base = getApiBase();
  if (!base) throw new Error('API base URL unavailable');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
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
  existingAlertSummaries: { title: string; summary: string }[] = []
): Promise<GeneratedAlertsResult> {
  return postJson<GeneratedAlertsResult>(
    '/agents/generate-alerts',
    { spec, count, existingAlertSummaries },
    45000
  );
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

export type { AlertData, InterestSpecData, ParsedInterestResult, GeneratedAlertsResult };
