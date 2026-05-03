import type { Alert, FreshnessLevel, InterestSpec, SourceType } from '@/types';
import type { AgentStep } from '@workspace/api-client-react';
import { callGenerateAlerts } from './ApiClient';

export interface GenerateAlertsWithStepsResult {
  alerts: Alert[];
  steps: AgentStep[];
}

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

const SOURCE_NAMES: Record<SourceType, string> = {
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  reddit: 'Reddit',
  rss: '뉴스',
  match: 'KeyP 매칭',
};

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getFreshness(minutesAgo: number): FreshnessLevel {
  if (minutesAgo < 10) return 'live';
  if (minutesAgo < 60) return 'hot';
  if (minutesAgo < 360) return 'recent';
  return 'older';
}

const FALLBACK_TEMPLATES: Record<
  InterestSpec['intentType'],
  Array<{ title: (t: string) => string; summary: (t: string) => string; source: SourceType }>
> = {
  alert: [
    {
      title: (t) => `[속보] ${t} 공식 발표 — 커뮤니티 반응 폭발`,
      summary: (t) =>
        `${t} 관련 공식 채널에서 새로운 발표가 있었습니다. 팬들의 뜨거운 반응이 이어지고 있으며, 관련 해시태그가 실시간 트렌드 1위에 올랐습니다.`,
      source: 'twitter',
    },
  ],
  monitor: [
    {
      title: (t) => `${t} 주간 동향 요약`,
      summary: (t) =>
        `${t} 관련 이번 주 주요 이슈와 트렌드를 정리했습니다. 주요 미디어 언급량이 전주 대비 32% 증가했으며, 긍정 반응 비율이 높습니다.`,
      source: 'rss',
    },
  ],
  travel: [
    {
      title: (t) => `${t} 현지인 추천 숨은 명소 10곳`,
      summary: (t) =>
        `${t} 여행자들이 놓치기 쉬운 현지인 추천 장소들입니다. 주요 관광지보다 덜 붐비면서도 만족도가 높은 스팟들을 소개합니다.`,
      source: 'youtube',
    },
  ],
  opportunity: [
    {
      title: (t) => `${t} 분야 신규 투자 기회 포착`,
      summary: (t) =>
        `${t} 관련 시장에서 새로운 투자 기회가 발견되었습니다. 전문가 분석에 따르면 향후 12개월 내 주목할 만한 성장이 예상됩니다.`,
      source: 'twitter',
    },
  ],
  creator_watch: [
    {
      title: (t) => `${t} 신규 콘텐츠 업로드 — 팬 반응은?`,
      summary: (t) =>
        `${t} 관련 크리에이터가 새로운 콘텐츠를 업로드했습니다. 첫 1시간 내 높은 조회수를 기록하며 알고리즘 추천 가능성이 높습니다.`,
      source: 'youtube',
    },
  ],
  match: [
    {
      title: (t) => `${t} 관심사 공유 매칭 발견`,
      summary: (t) =>
        `${t} 관심사를 가진 KeyP 사용자와의 매칭이 발견되었습니다. 상대방도 비슷한 관심사와 목적을 가지고 있어 높은 호환성이 예상됩니다.`,
      source: 'match',
    },
  ],
  local_signal: [
    {
      title: (t) => `${t} 근처 최신 동향`,
      summary: (t) =>
        `${t} 주변 지역에서 관련 이벤트와 신호가 감지되었습니다. 현지 커뮤니티의 반응이 활발합니다.`,
      source: 'reddit',
    },
  ],
};

function fallbackAlerts(spec: InterestSpec, count: number): Alert[] {
  const templates = FALLBACK_TEMPLATES[spec.intentType] ?? FALLBACK_TEMPLATES.monitor;
  const alerts: Alert[] = [];
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const minutesAgo = randomBetween(2, 300);
    const confidence = randomBetween(65, 97);
    alerts.push({
      id: generateId(),
      interestId: spec.id,
      interestName: spec.topic,
      title: template.title(spec.topic),
      summary: template.summary(spec.topic),
      reason: `${spec.topic} 관심사와 관련된 신호 감지`,
      confidence,
      freshness: getFreshness(minutesAgo),
      source: { type: template.source, name: SOURCE_NAMES[template.source] },
      tags: spec.entities.slice(0, 3),
      isSaved: false,
      createdAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
    });
  }
  return alerts;
}

const VALID_FRESHNESS = new Set<FreshnessLevel>(['live', 'hot', 'recent', 'older']);
const VALID_SOURCES_ALERT = new Set<SourceType>(['youtube', 'twitter', 'reddit', 'rss', 'match']);

export async function generateAlertsForSpec(
  spec: InterestSpec,
  count = 3,
  existingAlertSummaries: { title: string; summary: string }[] = []
): Promise<GenerateAlertsWithStepsResult> {
  try {
    const result = await callGenerateAlerts(
      {
        intentType: spec.intentType,
        topic: spec.topic,
        entities: spec.entities,
        locationScope: spec.locationScope ?? null,
        urgency: spec.urgency,
        desiredOutcome: spec.desiredOutcome,
        trustNeed: spec.trustNeed,
        matchMode: spec.matchMode ?? null,
        privacyLevel: spec.privacyLevel,
        negativeConstraints: spec.negativeConstraints,
        suggestedSources: spec.suggestedSources,
        targetPersona: spec.targetPersona,
        searchStrategy: spec.searchStrategy,
      },
      count,
      existingAlertSummaries
    );
    const alerts = (result.alerts ?? []).map((a): Alert => {
      const sourceType: SourceType = VALID_SOURCES_ALERT.has(a.source.type as SourceType)
        ? (a.source.type as SourceType)
        : 'rss';
      const freshness: FreshnessLevel = VALID_FRESHNESS.has(a.freshness as FreshnessLevel)
        ? (a.freshness as FreshnessLevel)
        : 'recent';
      const sourceUrl =
        typeof a.source.url === 'string' && a.source.url.length > 0
          ? a.source.url
          : undefined;
      return {
        id: generateId(),
        interestId: spec.id,
        interestName: spec.topic,
        title: a.title,
        summary: a.summary,
        reason: a.reason,
        confidence: Math.min(100, Math.max(0, Math.round(a.confidence))),
        freshness,
        source: {
          type: sourceType,
          name: a.source.name || SOURCE_NAMES[sourceType],
          url: sourceUrl,
        },
        originalUrl: sourceUrl,
        tags: a.tags ?? spec.entities.slice(0, 3),
        isSaved: false,
        createdAt: new Date(
          Date.now() - (a.minutesAgo ?? 30) * 60 * 1000
        ).toISOString(),
      };
    });
    return { alerts, steps: result.steps ?? [] };
  } catch (err) {
    console.warn('[KeyP] generateAlerts API failed, using local fallback:', err);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      alerts: fallbackAlerts(spec, count),
      steps: [
        {
          agent: 'Collector',
          status: 'failed',
          message: '서버 호출 실패 — 로컬 템플릿 사용',
          durationMs: 800,
        },
        {
          agent: 'Verifier',
          status: 'partial',
          message: '검증 건너뜀',
          durationMs: 0,
        },
        {
          agent: 'Deliverer',
          status: 'success',
          message: `${count}건 폴백 알림 생성`,
          durationMs: 0,
        },
      ],
    };
  }
}

export function computeSourceScore(
  source: SourceType,
  spec: InterestSpec
): number {
  const positionInSuggested = spec.suggestedSources.indexOf(source);
  const basePriority = positionInSuggested >= 0 ? (5 - positionInSuggested) * 20 : 0;
  const urgencyBonus = spec.urgency === 'high' ? 10 : spec.urgency === 'medium' ? 5 : 0;
  const noise = Math.random() * 10;
  return Math.min(100, basePriority + urgencyBonus + noise);
}
