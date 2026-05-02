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
  count = 3
): Promise<GeneratedAlertsResult> {
  return postJson<GeneratedAlertsResult>('/agents/generate-alerts', { spec, count }, 45000);
}

export type { AlertData, InterestSpecData, ParsedInterestResult, GeneratedAlertsResult };
