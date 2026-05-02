import type { IntentType, InterestSpec, MatchMode, SourceType, Urgency } from '@/types';
import { callParseInterest } from './ApiClient';

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
    if (
      word.length >= 2 &&
      !['알려줘', '싶어', '하고', '이고', '있어', '정보', '관련', '대한'].includes(word)
    ) {
      entities.push(word);
    }
  }
  return [...new Set(entities)].slice(0, 6);
}

function extractLocation(text: string): string | undefined {
  const locationPatterns = [
    '서울', '부산', '뉴욕', '도쿄', '런던', '파리', 'LA', '홍콩',
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

function generateTopic(text: string): string {
  const cleaned = text
    .replace(/알려줘|싶어요|해줘|정보|관련|대한|찾고|있어|하고|이고/g, '')
    .trim();
  return cleaned.length > 20 ? cleaned.slice(0, 20) + '...' : cleaned;
}

function fallbackSpec(userId: string, rawText: string): InterestSpec {
  const intentType = detectIntent(rawText);
  const urgency = detectUrgency(rawText);
  const entities = extractEntities(rawText);
  const location = extractLocation(rawText);
  const matchMode = detectMatchMode(rawText);
  const topic = generateTopic(rawText);
  const now = new Date().toISOString();
  const suggestedSources: SourceType[] = matchMode
    ? ['match', 'twitter', 'reddit']
    : ['twitter', 'youtube', 'reddit', 'rss'];
  return {
    id: generateId(),
    userId,
    rawText,
    intentType,
    topic,
    entities,
    locationScope: location,
    urgency,
    desiredOutcome: `${topic} 관련 동향 추적`,
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

const VALID_INTENTS = new Set<IntentType>([
  'monitor', 'alert', 'opportunity', 'match', 'creator_watch', 'travel', 'local_signal',
]);
const VALID_URGENCIES = new Set<Urgency>(['low', 'medium', 'high']);
const VALID_TRUST = new Set<'low' | 'medium' | 'high'>(['low', 'medium', 'high']);
const VALID_MATCH_MODES = new Set<MatchMode>([
  'friend', 'companion', 'collaborate', 'meal_mate', 'date',
]);
const VALID_PRIVACY = new Set<'public' | 'friends' | 'private'>(['public', 'friends', 'private']);
const VALID_SOURCES = new Set<SourceType>(['youtube', 'twitter', 'reddit', 'rss', 'match']);

function safeEnum<T>(value: unknown, valid: Set<T>, fallback: T): T {
  return valid.has(value as T) ? (value as T) : fallback;
}

export async function parseInterest(
  userId: string,
  rawText: string
): Promise<InterestSpec> {
  try {
    const result = await callParseInterest(rawText, userId);
    const s = result.spec;
    const now = new Date().toISOString();
    const sources = (s.suggestedSources ?? [])
      .filter((src): src is SourceType => VALID_SOURCES.has(src as SourceType));
    return {
      id: generateId(),
      userId,
      rawText,
      intentType: safeEnum(s.intentType, VALID_INTENTS, 'monitor'),
      topic: s.topic || rawText.slice(0, 30),
      entities: Array.isArray(s.entities) ? s.entities.slice(0, 6) : [],
      locationScope: s.locationScope ?? undefined,
      urgency: safeEnum(s.urgency, VALID_URGENCIES, 'medium'),
      desiredOutcome: s.desiredOutcome || `${s.topic} 관련 동향 추적`,
      trustNeed: safeEnum(s.trustNeed, VALID_TRUST, 'medium'),
      matchMode: s.matchMode != null && VALID_MATCH_MODES.has(s.matchMode as MatchMode)
        ? (s.matchMode as MatchMode)
        : undefined,
      privacyLevel: safeEnum(s.privacyLevel, VALID_PRIVACY, 'public'),
      negativeConstraints: s.negativeConstraints ?? [],
      suggestedSources: sources.length > 0 ? sources : ['twitter', 'youtube', 'reddit', 'rss'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  } catch (err) {
    console.warn('[KeyP] parseInterest API failed, using local fallback:', err);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return fallbackSpec(userId, rawText);
  }
}
