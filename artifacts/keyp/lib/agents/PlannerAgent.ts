import type { IntentType, InterestSpec, MatchMode, SourceType, Urgency } from '@/types';

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  travel: ['여행', '방문', '관광', '투어', '여정', 'trip', 'travel', '해외'],
  alert: ['알림', '새로운', '최신', '업데이트', '발표', '공지', '소식'],
  opportunity: ['투자', '기회', '뜨는', '성장', '유망', '수익', '비즈니스'],
  creator_watch: ['인플루언서', '크리에이터', '유튜버', '구독', '채널', '팔로우'],
  match: ['친구', '동행', '함께', '만날', '모임', '동호회', '메이트'],
  monitor: ['모니터링', '추적', '관찰', '확인', '체크', '감시'],
  local_signal: ['근처', '주변', '동네', '지역', '로컬', '현지'],
};

const URGENCY_KEYWORDS: Record<Urgency, string[]> = {
  high: ['긴급', '빨리', '지금', '당장', '즉시', '빠른', '내일', '다음주'],
  medium: ['다음달', '곧', '가까운', '이번달', '준비'],
  low: ['언젠가', '나중에', '천천히', '미래', '장기'],
};

const SOURCE_MAPPING: Record<string, SourceType[]> = {
  kpop: ['youtube', 'twitter', 'reddit'],
  music: ['youtube', 'twitter', 'reddit'],
  travel: ['youtube', 'reddit', 'rss'],
  sports: ['twitter', 'youtube', 'reddit'],
  tech: ['twitter', 'reddit', 'rss'],
  finance: ['twitter', 'rss', 'reddit'],
  news: ['rss', 'twitter', 'reddit'],
  default: ['twitter', 'youtube', 'reddit', 'rss'],
};

function detectIntent(text: string): IntentType {
  let maxScore = 0;
  let detected: IntentType = 'monitor';

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > maxScore) {
      maxScore = score;
      detected = intent as IntentType;
    }
  }
  return detected;
}

function detectUrgency(text: string): Urgency {
  for (const [urgency, keywords] of Object.entries(URGENCY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return urgency as Urgency;
    }
  }
  return 'medium';
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const words = text.split(/[\s,]+/);

  for (const word of words) {
    if (word.length >= 2 && !['알려줘', '싶어', '하고', '이고', '있어', '정보', '관련', '대한'].includes(word)) {
      entities.push(word);
    }
  }

  return [...new Set(entities)].slice(0, 6);
}

function extractLocation(text: string): string | undefined {
  const locationPatterns = [
    '서울', '부산', '뉴욕', '도쿄', '런던', '파리', 'LA', '뉴욕', '홍콩',
    '싱가포르', '방콕', '베이징', '상하이', '대구', '인천', '광주', '대전',
  ];
  return locationPatterns.find((loc) => text.includes(loc));
}

function detectMatchMode(text: string): MatchMode | undefined {
  if (['동행', '함께', '같이'].some((kw) => text.includes(kw))) return 'companion';
  if (['친구', '사귀'].some((kw) => text.includes(kw))) return 'friend';
  if (['협업', '함께 일'].some((kw) => text.includes(kw))) return 'collaborate';
  if (['밥', '식사', '밥친구'].some((kw) => text.includes(kw))) return 'meal_mate';
  if (['데이트', '만남', '소개팅'].some((kw) => text.includes(kw))) return 'date';
  return undefined;
}

function selectSources(text: string, intent: IntentType): SourceType[] {
  const lower = text.toLowerCase();

  if (['kpop', 'k-pop', '아이돌', '방탄', 'bts', '블랙핑크', '뉴진스'].some(k => lower.includes(k))) {
    return SOURCE_MAPPING.kpop;
  }
  if (['여행', 'travel'].some(k => lower.includes(k))) return SOURCE_MAPPING.travel;
  if (['축구', '야구', '농구', '스포츠', '경기'].some(k => lower.includes(k))) return SOURCE_MAPPING.sports;
  if (['ai', '기술', '개발', '프로그래밍', '스타트업'].some(k => lower.includes(k))) return SOURCE_MAPPING.tech;
  if (['투자', '주식', '코인', '암호화폐', '비트코인'].some(k => lower.includes(k))) return SOURCE_MAPPING.finance;

  if (intent === 'creator_watch') return ['youtube', 'twitter'];
  if (intent === 'travel') return SOURCE_MAPPING.travel;
  if (intent === 'opportunity') return SOURCE_MAPPING.finance;

  return SOURCE_MAPPING.default;
}

function generateTopic(text: string): string {
  const cleaned = text
    .replace(/알려줘|싶어요|해줘|정보|관련|대한|찾고|있어|하고|이고/g, '')
    .trim();
  return cleaned.length > 20 ? cleaned.slice(0, 20) + '...' : cleaned;
}

function generateOutcome(intentType: IntentType, topic: string): string {
  const outcomes: Record<IntentType, string> = {
    monitor: `${topic} 관련 최신 동향 모니터링`,
    alert: `${topic} 중요 알림 즉시 수신`,
    opportunity: `${topic} 투자/기회 발견`,
    match: `${topic} 관심사 기반 사람 연결`,
    creator_watch: `${topic} 새 콘텐츠 알림`,
    travel: `${topic} 현지 정보 및 팁 수집`,
    local_signal: `${topic} 지역 신호 탐지`,
  };
  return outcomes[intentType];
}

export async function parseInterest(
  userId: string,
  rawText: string
): Promise<InterestSpec> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const intentType = detectIntent(rawText);
  const urgency = detectUrgency(rawText);
  const entities = extractEntities(rawText);
  const location = extractLocation(rawText);
  const matchMode = detectMatchMode(rawText);
  const suggestedSources = selectSources(rawText, intentType);
  const topic = generateTopic(rawText);
  const desiredOutcome = generateOutcome(intentType, topic);
  const now = new Date().toISOString();

  return {
    id: generateId(),
    userId,
    rawText,
    intentType,
    topic,
    entities,
    locationScope: location,
    urgency,
    desiredOutcome,
    trustNeed: urgency === 'high' ? 'high' : 'medium',
    matchMode,
    privacyLevel: matchMode ? 'friends' : 'public',
    negativeConstraints: [],
    suggestedSources,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}
