import type { Alert, FreshnessLevel, InterestSpec, SourceType } from '@/types';

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

const TEMPLATES: Record<
  InterestSpec['intentType'],
  Array<{
    title: (topic: string) => string;
    summary: (topic: string) => string;
    source: SourceType;
  }>
> = {
  alert: [
    {
      title: (t) => `[속보] ${t} 공식 발표 — 커뮤니티 반응 폭발`,
      summary: (t) =>
        `${t} 관련 공식 채널에서 새로운 발표가 있었습니다. 팬들의 뜨거운 반응이 이어지고 있으며, 관련 해시태그가 실시간 트렌드 1위에 올랐습니다.`,
      source: 'twitter',
    },
    {
      title: (t) => `${t} 일정 최초 공개 — 티켓 정보는?`,
      summary: (t) =>
        `${t}의 공식 일정이 처음으로 공개되었습니다. 선예매 일정과 티켓 가격대가 공개될 예정으로 관심 있는 분들은 빠른 확인이 필요합니다.`,
      source: 'youtube',
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
    {
      title: (t) => `${t} 여행자 커뮤니티 최신 후기 모음`,
      summary: (t) =>
        `${t} 를 다녀온 여행자들의 생생한 후기가 모였습니다. 숙소, 맛집, 교통 관련 실용적인 팁이 포함되어 있습니다.`,
      source: 'reddit',
    },
  ],
  opportunity: [
    {
      title: (t) => `${t} 분야 신규 투자 기회 포착`,
      summary: (t) =>
        `${t} 관련 시장에서 새로운 투자 기회가 발견되었습니다. 전문가 분석에 따르면 향후 12개월 내 주목할 만한 성장이 예상됩니다.`,
      source: 'twitter',
    },
    {
      title: (t) => `${t} 관련 스타트업, 대형 VC 투자 유치`,
      summary: (t) =>
        `${t} 분야의 신생 스타트업이 주요 벤처캐피털로부터 대규모 투자를 유치했습니다. 시장의 높은 관심을 반영합니다.`,
      source: 'rss',
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

export async function generateAlertsForSpec(
  spec: InterestSpec,
  count = 3
): Promise<Alert[]> {
  await new Promise((resolve) =>
    setTimeout(resolve, randomBetween(1000, 2500))
  );

  const templates = TEMPLATES[spec.intentType] ?? TEMPLATES['monitor'];
  const alerts: Alert[] = [];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const minutesAgo = randomBetween(2, 300);
    const confidence = randomBetween(65, 97);
    const freshness = getFreshness(minutesAgo);

    alerts.push({
      id: generateId(),
      interestId: spec.id,
      interestName: spec.topic,
      title: template.title(spec.topic),
      summary: template.summary(spec.topic),
      reason: `${spec.topic} 관심사와 관련된 신호 감지 (${spec.suggestedSources[0]} 1순위)`,
      confidence,
      freshness,
      source: {
        type: template.source,
        name: SOURCE_NAMES[template.source],
      },
      tags: spec.entities.slice(0, 3),
      isSaved: false,
      createdAt: new Date(
        Date.now() - minutesAgo * 60 * 1000
      ).toISOString(),
    });
  }

  return alerts;
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
