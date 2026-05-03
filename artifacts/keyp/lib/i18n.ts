/**
 * KeyP i18n — minimal, dependency-free Korean/English string table.
 *
 * How to add a new string:
 *   1. Add a key to `STRINGS` below with `{ ko, en }` translations.
 *   2. Call `t('your.key', language)` from any component (or use the
 *      `useI18n()` hook for the most ergonomic call site:
 *        `const { t } = useI18n();  t('your.key');`).
 *   3. For interpolation, use `{var}` placeholders in both translations
 *      and pass a `vars` object: `t('foo.count', language, { n: 5 })`.
 *
 * Lookup rules:
 *   - If the key+language exists, return that string with `{var}`
 *     placeholders substituted.
 *   - Else, fall back to the Korean translation for that key.
 *   - Else, fall back to the key itself (so missing strings are obvious).
 *
 * Brand "KeyP" is never translated. Plan tier names (Free/Basic/Pro/Power)
 * and the brand verb "속보" are also kept identical across languages.
 */

export type Language = 'ko' | 'en';

export const SUPPORTED_LANGUAGES: Language[] = ['ko', 'en'];

/**
 * Map a raw device locale (e.g. "ko-KR", "en-US", "ja-JP") to a supported
 * Language. Anything starting with "ko" → 'ko'; everything else → 'en'.
 * `null`/`undefined` → 'en' (international-audience default).
 */
export function detectLanguage(locale?: string | null): Language {
  if (!locale) return 'en';
  return locale.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

/**
 * Relative-time formatter localized for ko/en.
 * `deltaMs` = positive number of ms IN THE PAST (Date.now() - timestamp).
 */
export function relativeTime(deltaMs: number, lang: Language): string {
  if (deltaMs < 0) deltaMs = 0;
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 1) return lang === 'ko' ? '방금' : 'just now';
  if (mins < 60) {
    return lang === 'ko' ? `${mins}분 전` : `${mins} min ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return lang === 'ko' ? `${hrs}시간 전` : `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  return lang === 'ko' ? `${days}일 전` : `${days}d ago`;
}

export const STRINGS: Record<string, Record<Language, string>> = {
  // ─── Common ─────────────────────────────────────────────────────────
  'common.cancel': { ko: '취소', en: 'Cancel' },
  'common.confirm': { ko: '확인', en: 'OK' },
  'common.error': { ko: '오류', en: 'Error' },
  'common.retry': { ko: '다시 시도', en: 'Try again' },
  'common.back': { ko: '뒤로', en: 'Back' },
  'common.notFound': { ko: '찾을 수 없습니다', en: 'Not found' },
  'common.never': { ko: '아직 없음', en: 'never' },
  'common.none': { ko: '아직', en: '—' },
  'common.count': { ko: '{n}개', en: '{n}' },
  'common.brand': { ko: 'KeyP', en: 'KeyP' },

  // ─── Tabs ──────────────────────────────────────────────────────────
  'tabs.feed': { ko: '피드', en: 'Feed' },
  'tabs.interests': { ko: '관심사', en: 'Interests' },
  'tabs.match': { ko: '매칭', en: 'Match' },
  'tabs.profile': { ko: '프로필', en: 'Profile' },

  // ─── Feed ──────────────────────────────────────────────────────────
  'feed.subtitle': { ko: '실시간 관심사 알림', en: 'Real-time interest alerts' },
  'feed.home': { ko: '홈으로', en: 'Home' },
  'feed.allFilter': { ko: '전체', en: 'All' },
  'feed.empty.title': { ko: '아직 알림이 없어요', en: 'No alerts yet' },
  'feed.empty.subtitle': {
    ko: '관심사를 등록하면 AI가 관련 소식을 먼저 찾아드립니다',
    en: 'Register an interest and our AI will find related news for you first.',
  },
  'feed.empty.action': { ko: '관심사 등록', en: 'Register an interest' },

  // ─── Interests list ─────────────────────────────────────────────────
  'interests.title': { ko: '관심사', en: 'Interests' },
  'interests.subtitle': {
    ko: '{n}개 등록 · {m}개 알림',
    en: '{n} registered · {m} alerts',
  },
  'interests.realtime': { ko: '실시간 수집 · {label}', en: 'Live collecting · {label}' },
  'interests.intervalEvery': { ko: '{n}분마다', en: 'every {n} min' },
  'interests.autoOff': { ko: '자동 수집 꺼짐', en: 'Auto-collect off' },
  'interests.lastAuto': { ko: '마지막 자동 수집: {t}', en: 'Last auto run: {t}' },
  'interests.refreshing': { ko: '수집 중', en: 'Collecting…' },
  'interests.refreshNow': { ko: '지금 수집', en: 'Collect now' },
  'interests.empty.title': { ko: '관심사가 없어요', en: 'No interests yet' },
  'interests.empty.subtitle': {
    ko: '자연어로 원하는 것을 설명하면 AI가 관심사를 구조화해드립니다',
    en: 'Describe what you want in plain words — our AI will structure it into an interest.',
  },
  'interests.empty.action': { ko: '첫 관심사 등록', en: 'Add first interest' },

  // ─── Interest card / list shared ───────────────────────────────────
  'intent.monitor': { ko: '모니터링', en: 'Monitor' },
  'intent.alert': { ko: '알림', en: 'Alert' },
  'intent.opportunity': { ko: '기회탐지', en: 'Opportunity' },
  'intent.match': { ko: '매칭', en: 'Match' },
  'intent.creator_watch': { ko: '크리에이터', en: 'Creator' },
  'intent.travel': { ko: '여행', en: 'Travel' },
  'intent.local_signal': { ko: '로컬', en: 'Local' },

  'urgency.high': { ko: '긴급', en: 'High' },
  'urgency.medium': { ko: '보통', en: 'Medium' },
  'urgency.low': { ko: '낮음', en: 'Low' },

  'privacy.public': { ko: '공개', en: 'Public' },
  'privacy.friends': { ko: '친구', en: 'Friends' },
  'privacy.private': { ko: '비공개', en: 'Private' },

  'sourceShort.youtube': { ko: 'YT', en: 'YT' },
  'sourceShort.twitter': { ko: 'X', en: 'X' },
  'sourceShort.reddit': { ko: 'RD', en: 'RD' },
  'sourceShort.rss': { ko: 'RSS', en: 'RSS' },
  'sourceShort.match': { ko: '매칭', en: 'Match' },

  'source.youtube': { ko: 'YouTube', en: 'YouTube' },
  'source.twitter': { ko: 'Twitter/X', en: 'Twitter/X' },
  'source.reddit': { ko: 'Reddit', en: 'Reddit' },
  'source.rss': { ko: 'RSS/뉴스', en: 'RSS / News' },
  'source.match': { ko: 'KeyP 매칭', en: 'KeyP Match' },

  // ─── Interest detail ───────────────────────────────────────────────
  'interest.detail.title': { ko: '관심사 상세', en: 'Interest detail' },
  'interest.detail.notFound': {
    ko: '관심사를 찾을 수 없습니다',
    en: 'Interest not found',
  },
  'interest.detail.statTotal': { ko: '총 알림', en: 'Total alerts' },
  'interest.detail.statUrgency': { ko: '긴급도', en: 'Urgency' },
  'interest.detail.statPrivacy': { ko: '공개범위', en: 'Visibility' },
  'interest.detail.aiTitle': { ko: 'AI 분석 결과', en: 'AI analysis' },
  'interest.detail.goal': { ko: '목표', en: 'Goal' },
  'interest.detail.region': { ko: '지역', en: 'Region' },
  'interest.detail.sources': { ko: '수집 소스', en: 'Sources' },
  'interest.detail.realtime': { ko: '실시간 수집 중', en: 'Live collecting' },
  'interest.detail.autoOff': { ko: '자동 수집 꺼짐', en: 'Auto-collect off' },
  'interest.detail.lastCollect': { ko: '마지막 수집: {t}', en: 'Last run: {t}' },
  'interest.detail.refresh': { ko: '지금 수집', en: 'Collect now' },
  'interest.detail.refreshing': { ko: '수집 중...', en: 'Collecting…' },
  'interest.detail.boost': { ko: '속보', en: '속보' }, // brand verb, kept
  'interest.detail.boosting': { ko: '속보 중...', en: '속보…' },
  'interest.detail.alertHistory': { ko: '알림 히스토리 {n}개', en: 'Alert history · {n}' },
  'interest.detail.empty.title': { ko: '알림 수집 중', en: 'Collecting alerts' },
  'interest.detail.empty.subtitle': {
    ko: 'AI 에이전트가 관련 소식을 찾고 있어요. 잠시 후 알림이 도착합니다.',
    en: 'Our AI agents are searching for related news. Alerts will arrive shortly.',
  },
  'interest.detail.boostPlan.title': {
    ko: '속보는 Pro 이상 플랜 전용이에요',
    en: '속보 is only available on Pro or Power plans',
  },
  'interest.detail.boostPlan.body': {
    ko: '월 5회(Pro) / 30회(Power) 즉시 갱신 알림을 받을 수 있어요.',
    en: 'Get 5 (Pro) or 30 (Power) instant-refresh alerts per month.',
  },
  'interest.detail.boostPlan.viewPricing': { ko: '요금제 보기', en: 'See pricing' },
  'interest.detail.boostDone.title': { ko: '속보 갱신 완료', en: '속보 refreshed' },
  'interest.detail.boostDone.body': {
    ko: '이번 달 남은 횟수: {remaining}/{quota}',
    en: 'Remaining this month: {remaining}/{quota}',
  },
  'interest.detail.boostFail.title': { ko: '속보 사용 불가', en: '속보 unavailable' },
  'interest.detail.boostFail.quota': {
    ko: '이번 달 속보 횟수를 모두 사용했어요 ({used}/{quota}).',
    en: 'You\'ve used all your 속보 quota this month ({used}/{quota}).',
  },
  'interest.detail.boostFail.plan': {
    ko: '속보는 Pro 이상 플랜에서 사용할 수 있어요.',
    en: '속보 is only available on Pro or Power plans.',
  },
  'interest.detail.boostFail.generic': {
    ko: '속보 갱신에 실패했어요. 잠시 후 다시 시도해 주세요.',
    en: 'Failed to refresh. Please try again in a moment.',
  },
  'interest.detail.boostError': {
    ko: '속보 요청에 실패했어요.',
    en: '속보 request failed.',
  },
  'interest.detail.refreshTitle': { ko: '실시간 수집', en: 'Live collection' },
  'interest.detail.refreshNew': {
    ko: '새 알림 {n}건을 가져왔어요.',
    en: 'Brought in {n} new alerts.',
  },
  'interest.detail.refreshCooldown': {
    ko: '잠시 후 다시 시도해주세요. (쿨다운)',
    en: 'Please try again in a moment (cooldown).',
  },
  'interest.detail.refreshNoNew': {
    ko: '아직 새로운 소식이 없어요.',
    en: 'No new updates yet.',
  },

  // ─── Add interest ──────────────────────────────────────────────────
  'interest.add.title': { ko: '관심사 등록', en: 'Add interest' },
  'interest.add.intro.title': {
    ko: '관심사를 자연어로 입력하세요',
    en: 'Describe your interest in plain words',
  },
  'interest.add.intro.subtitle': {
    ko: 'AI 플래너 에이전트가 분석해 최적의 소스를 찾아드립니다',
    en: 'Our AI planner agent will analyze it and find the best sources.',
  },
  'interest.add.placeholder': {
    ko: '예) 다음 달 도쿄 여행 정보 + 현지 맛집, BTS 월드투어 일정...',
    en: 'e.g. Tokyo travel tips + local food next month, BTS world-tour dates…',
  },
  'interest.add.analyze': { ko: 'AI 분석', en: 'Analyze' },
  'interest.add.examplesTitle': { ko: '예시', en: 'Examples' },
  'interest.add.example.0': {
    ko: '방탄소년단 콘서트 일정 알려줘',
    en: 'Tell me BTS concert dates',
  },
  'interest.add.example.1': {
    ko: '다음 달 뉴욕 여행 정보 + 현지 동행자 찾고 싶어',
    en: 'NYC trip next month + find a local travel buddy',
  },
  'interest.add.example.2': {
    ko: '국내 AI 스타트업 투자 기회 탐지해줘',
    en: 'Find AI startup investment opportunities',
  },
  'interest.add.example.3': {
    ko: '호날두 최신 경기 소식 + 기록 업데이트',
    en: 'Latest Ronaldo match news + record updates',
  },
  'interest.add.example.4': {
    ko: '서울 힙한 카페 오픈 소식 모니터링',
    en: 'Monitor new trendy café openings in Seoul',
  },
  'interest.add.analyzing.title': {
    ko: 'AI 에이전트 분석 중...',
    en: 'AI agents analyzing…',
  },
  'interest.add.analyzing.subtitle': {
    ko: '{done}/{total} 단계 완료 · 실제 웹에서 실시간 신호를 수집합니다',
    en: '{done}/{total} steps done · collecting live signals from the open web',
  },
  'interest.add.success': {
    ko: '분석 완료 · {ok}/{total} 단계 성공',
    en: 'Analysis complete · {ok}/{total} steps succeeded',
  },
  'interest.add.spec.intent': { ko: '의도 유형', en: 'Intent type' },
  'interest.add.spec.urgency': { ko: '긴급도', en: 'Urgency' },
  'interest.add.spec.region': { ko: '지역 범위', en: 'Region scope' },
  'interest.add.spec.goal': { ko: '목표', en: 'Goal' },
  'interest.add.spec.entities': { ko: '키 엔티티', en: 'Key entities' },
  'interest.add.spec.sourcesPriority': {
    ko: '수집 소스 우선순위',
    en: 'Source priority',
  },
  'interest.add.retry': { ko: '다시 입력', en: 'Try again' },
  'interest.add.done': { ko: '피드 확인하기', en: 'See feed' },
  'interest.add.error.body': {
    ko: '분석 중 오류가 발생했습니다. 다시 시도해주세요.',
    en: 'An error occurred during analysis. Please try again.',
  },
  'interest.add.agent.Planner.label': { ko: 'Planner', en: 'Planner' },
  'interest.add.agent.Planner.desc': {
    ko: '관심사 의도/엔티티 구조화 (GPT-5.4)',
    en: 'Structures intent + entities (GPT-5.4)',
  },
  'interest.add.agent.SourceRouter.label': { ko: 'SourceRouter', en: 'SourceRouter' },
  'interest.add.agent.SourceRouter.desc': {
    ko: '최적 소스 우선순위 계산',
    en: 'Computes optimal source priority',
  },
  'interest.add.agent.Collector.label': { ko: 'Collector', en: 'Collector' },
  'interest.add.agent.Collector.desc': {
    ko: '실시간 웹검색 (Perplexity Sonar)',
    en: 'Live web search (Perplexity Sonar)',
  },
  'interest.add.agent.Verifier.label': { ko: 'Verifier', en: 'Verifier' },
  'interest.add.agent.Verifier.desc': {
    ko: '신뢰도/관련성 검증 (Claude Sonnet 4.6)',
    en: 'Credibility + relevance check (Claude Sonnet 4.6)',
  },
  'interest.add.agent.Deliverer.label': { ko: 'Deliverer', en: 'Deliverer' },
  'interest.add.agent.Deliverer.desc': {
    ko: '신선도×신뢰도 정렬',
    en: 'Sort by freshness × credibility',
  },

  // ─── Alert card / detail ───────────────────────────────────────────
  'alert.openSource': { ko: '출처 보기 · {name}', en: 'Open source · {name}' },
  'alert.openOriginal': { ko: '원문 보기 — {name}', en: 'Open original — {name}' },
  'alert.notFound': { ko: '알림을 찾을 수 없습니다', en: 'Alert not found' },
  'alert.summary': { ko: '요약', en: 'Summary' },
  'alert.why': { ko: '왜 이 알림이 왔나요?', en: 'Why this alert?' },
  'alert.relatedTags': { ko: '관련 태그', en: 'Related tags' },
  'alert.feedback.helpful': {
    ko: '이 알림이 도움이 됐나요?',
    en: 'Was this alert helpful?',
  },
  'alert.feedback.like': { ko: '좋아요', en: 'Like' },
  'alert.feedback.dislike': { ko: '별로예요', en: 'Dislike' },
  'alert.feedback.more': { ko: '더 보기', en: 'More like this' },
  'alert.feedback.hide': { ko: '숨기기', en: 'Hide' },

  'confidence.label': { ko: '신뢰도 {n}%', en: 'Confidence {n}%' },
  'freshness.live': { ko: '실시간', en: 'Live' },
  'freshness.hot': { ko: '핫', en: 'Hot' },
  'freshness.recent': { ko: '최신', en: 'Recent' },
  'freshness.older': { ko: '이전', en: 'Older' },

  // ─── Match list / detail ───────────────────────────────────────────
  'match.title': { ko: '매칭', en: 'Match' },
  'match.subtitle': {
    ko: '관심사 기반 내부 상호매칭 · opt-in 전용',
    en: 'Interest-based mutual matching · opt-in only',
  },
  'match.newProposals': {
    ko: '새로운 매칭 제안 {n}건',
    en: '{n} new match proposal(s)',
  },
  'match.acceptedHeader': { ko: '연결된 매칭', en: 'Connected matches' },
  'match.empty.title': { ko: '아직 매칭이 없어요', en: 'No matches yet' },
  'match.empty.subtitle': {
    ko: '관심사를 등록하면 비슷한 관심사를 가진 사람과 연결해드립니다',
    en: 'Register an interest and we\'ll connect you with people who share it.',
  },
  'match.info': {
    ko: '모든 매칭은 양측 동의 후에만 연결됩니다. 신고/차단 기능이 제공됩니다.',
    en: 'Connections require both sides to opt in. Reporting and blocking are supported.',
  },
  'match.shared': { ko: '공통 관심사', en: 'Shared interests' },
  'match.scoreLabel': { ko: '매칭', en: 'Match' },
  'match.modeLabel': { ko: '매칭 목적', en: 'Match goal' },
  'match.scoreCardLabel': { ko: '매칭 점수', en: 'Match score' },
  'match.detail.title': { ko: '매칭 상세', en: 'Match detail' },
  'match.detail.notFound': {
    ko: '매칭을 찾을 수 없습니다',
    en: 'Match not found',
  },
  'match.detail.why': { ko: '왜 연결됐나요?', en: 'Why connected?' },
  'match.detail.safety': {
    ko: '매칭 수락 전에는 정확한 위치와 연락처가 공개되지 않습니다. 모든 연결은 양측 동의 후에만 이루어집니다.',
    en: 'Exact location and contact info are hidden until you accept. Connections require mutual consent.',
  },
  'match.connected': { ko: '연결됨', en: 'Connected' },
  'match.connectedFooter': {
    ko: '연결됨 — 메시지를 시작해보세요',
    en: 'Connected — start a message',
  },
  'match.accept': { ko: '수락', en: 'Accept' },
  'match.acceptDetail': { ko: '수락하기', en: 'Accept' },
  'match.reject': { ko: '거절', en: 'Decline' },
  'match.acceptedAlert.title': { ko: '매칭 수락', en: 'Match accepted' },
  'match.acceptedAlert.body': {
    ko: '{name}님과 연결되었습니다! 메시지를 보내보세요.',
    en: 'You\'re connected with {name}! Send a message.',
  },
  'match.rejectConfirm.title': { ko: '매칭 거절', en: 'Decline match' },
  'match.rejectConfirm.body': {
    ko: '이 매칭 제안을 거절하시겠어요?',
    en: 'Decline this match proposal?',
  },
  'match.rejectConfirm.action': { ko: '거절', en: 'Decline' },
  'match.report.title': { ko: '신고', en: 'Report' },
  'match.report.body': {
    ko: '신고 사유를 선택해주세요.',
    en: 'Choose a reason to report.',
  },
  'match.report.spam': { ko: '스팸', en: 'Spam' },
  'match.report.bad': { ko: '부적절한 내용', en: 'Inappropriate content' },
  'match.mode.friend': { ko: '친구찾기', en: 'Friends' },
  'match.mode.companion': { ko: '동행', en: 'Companion' },
  'match.mode.companion.detail': { ko: '여행/현지 동행', en: 'Travel / local companion' },
  'match.mode.collaborate': { ko: '협업', en: 'Collaborate' },
  'match.mode.meal_mate': { ko: '밥친구', en: 'Meal mate' },
  'match.mode.date': { ko: '데이트', en: 'Date' },

  // ─── Profile ───────────────────────────────────────────────────────
  'profile.defaultUser': { ko: '사용자', en: 'User' },
  'profile.stat.interests': { ko: '관심사', en: 'Interests' },
  'profile.stat.alerts': { ko: '알림', en: 'Alerts' },
  'profile.stat.matches': { ko: '매칭', en: 'Matches' },
  'profile.stat.saved': { ko: '저장', en: 'Saved' },
  'profile.section.activity': { ko: '활동', en: 'Activity' },
  'profile.section.subscription': { ko: '구독', en: 'Subscription' },
  'profile.section.settings': { ko: '설정', en: 'Settings' },
  'profile.section.info': { ko: '정보', en: 'Info' },
  'profile.item.saved': { ko: '저장한 알림', en: 'Saved alerts' },
  'profile.item.interests': { ko: '관심사 관리', en: 'Manage interests' },
  'profile.item.matches': { ko: '매칭 현황', en: 'Match status' },
  'profile.item.plan': { ko: '요금제', en: 'Plan' },
  'profile.item.notifications': { ko: '알림 설정', en: 'Notifications' },
  'profile.item.report': { ko: '신고/차단 목록', en: 'Reports & blocks' },
  'profile.item.privacy': { ko: '개인정보 처리방침', en: 'Privacy policy' },
  'profile.item.terms': { ko: '이용약관', en: 'Terms of service' },
  'profile.item.appVersion': { ko: '앱 버전', en: 'App version' },
  'profile.item.agentStatus': { ko: 'AI 에이전트 상태', en: 'AI agents status' },
  'profile.item.agentStatusValue': { ko: '정상', en: 'Healthy' },
  'profile.item.language': { ko: '언어 / Language', en: 'Language / 언어' },
  'profile.plan.value': { ko: '{plan}', en: '{plan}' },
  'profile.plan.annualSuffix': { ko: ' · 연간', en: ' · Annual' },
  'profile.logout': { ko: '로그아웃', en: 'Log out' },
  'profile.logoutConfirm.title': { ko: '로그아웃', en: 'Log out' },
  'profile.logoutConfirm.body': {
    ko: '정말 로그아웃하시겠어요?',
    en: 'Are you sure you want to log out?',
  },
  'profile.agent.title': { ko: '에이전트 파이프라인', en: 'Agent pipeline' },
  'profile.agent.desc': {
    ko: 'Planner → SourceRouter → Scout → Verifier → Delivery → Learning',
    en: 'Planner → SourceRouter → Scout → Verifier → Delivery → Learning',
  },
  'profile.language.title': { ko: '언어 선택', en: 'Choose language' },
  'profile.language.ko': { ko: '한국어', en: '한국어' },
  'profile.language.en': { ko: 'English', en: 'English' },

  // ─── Saved ─────────────────────────────────────────────────────────
  'saved.title': { ko: '저장한 알림', en: 'Saved alerts' },
  'saved.empty.title': { ko: '저장한 알림이 없어요', en: 'No saved alerts' },
  'saved.empty.subtitle': {
    ko: '알림 카드에서 북마크 버튼을 눌러 저장하세요',
    en: 'Tap the bookmark button on any alert to save it.',
  },

  // ─── Onboarding ────────────────────────────────────────────────────
  'onboarding.skip': { ko: '건너뛰기', en: 'Skip' },
  'onboarding.next': { ko: '다음', en: 'Next' },
  'onboarding.start': { ko: '시작하기', en: 'Get started' },
  'onboarding.prev': { ko: '이전 슬라이드', en: 'Previous slide' },
  'onboarding.skipA11y': { ko: '온보딩 건너뛰기', en: 'Skip onboarding' },
  'onboarding.lang.title': { ko: '언어 선택 / Choose language', en: 'Choose language / 언어 선택' },
  'onboarding.lang.subtitle': {
    ko: '언제든지 프로필에서 변경할 수 있어요.',
    en: 'You can change this anytime from Profile.',
  },
  'onboarding.slide1.title': {
    ko: '검색이 아니라,\n당신의 관심사를\n먼저 알아채는 앱',
    en: 'Not search —\nan app that notices\nyour interests first.',
  },
  'onboarding.slide1.subtitle': {
    ko: 'KeyP는 자연어로 등록한 관심사를 AI가 구조화하고, 가장 확률 높은 소스부터 먼저 탐색합니다.',
    en: 'KeyP turns the interests you describe in plain words into structured signals, and searches the highest-probability sources first.',
  },
  'onboarding.slide2.title': {
    ko: '멀티 에이전트가\n당신 대신 일합니다',
    en: 'Multi-agent AI\nworks for you',
  },
  'onboarding.slide2.subtitle': {
    ko: '플래너, 소스 라우터, 수집, 검증, 전달 에이전트가 협력해 필요한 정보만 골라 알려줍니다.',
    en: 'Planner, source router, collector, verifier, and delivery agents collaborate so you only see what matters.',
  },
  'onboarding.slide3.title': {
    ko: '같은 관심사를 가진\n사람을 연결합니다',
    en: 'Connect with people\nwho share your interests',
  },
  'onboarding.slide3.subtitle': {
    ko: '관심사 기반 내부 상호매칭으로 동행, 협업, 친구를 찾을 수 있습니다. 완전 opt-in 방식.',
    en: 'Interest-based mutual matching to find companions, collaborators, or friends. Fully opt-in.',
  },

  // ─── Pricing ───────────────────────────────────────────────────────
  'pricing.title': { ko: '요금제', en: 'Pricing' },
  'pricing.subtitle': {
    ko: '더 빠른 폴링과 속보 알림으로 관심사를 놓치지 마세요.',
    en: 'Faster polling and 속보 alerts so you never miss what matters.',
  },
  'pricing.monthly': { ko: '월간', en: 'Monthly' },
  'pricing.annualMinus20': { ko: '연간 -20%', en: 'Annual -20%' },
  'pricing.free': { ko: '무료', en: 'Free' },
  'pricing.perMonth': { ko: '/월', en: '/mo' },
  'pricing.yearlyHint': {
    ko: '연 ₩{amount} 일시 결제',
    en: 'Billed ₩{amount} once a year',
  },
  'pricing.tagline.free': { ko: '체험용', en: 'For trying it out' },
  'pricing.tagline.basic': { ko: '입문', en: 'Starter' },
  'pricing.tagline.pro': { ko: '추천', en: 'Recommended' },
  'pricing.tagline.power': { ko: '파워유저', en: 'Power user' },
  'pricing.poll.free': { ko: '1시간 주기', en: 'Every 1 hour' },
  'pricing.poll.basic': { ko: '15분 주기', en: 'Every 15 min' },
  'pricing.poll.pro': { ko: '10분 주기', en: 'Every 10 min' },
  'pricing.poll.power': { ko: '5분 주기', en: 'Every 5 min' },
  'pricing.cap.free': { ko: '관심사 1개', en: '1 interest' },
  'pricing.cap.basic': { ko: '관심사 5개', en: '5 interests' },
  'pricing.cap.pro': { ko: '관심사 15개', en: '15 interests' },
  'pricing.cap.power': { ko: '관심사 30개', en: '30 interests' },
  'pricing.boost.free': { ko: '속보 알림 없음', en: 'No 속보 alerts' },
  'pricing.boost.basic': { ko: '속보 알림 없음', en: 'No 속보 alerts' },
  'pricing.boost.pro': { ko: '속보 알림 월 5회', en: '속보 alerts 5/mo' },
  'pricing.boost.power': { ko: '속보 알림 월 30회', en: '속보 alerts 30/mo' },
  'pricing.perks.basicAlert': { ko: '기본 알림', en: 'Basic alerts' },
  'pricing.perks.savedFew': { ko: '저장 5건', en: '5 saved items' },
  'pricing.perks.savedUnlimited': { ko: '저장 무제한', en: 'Unlimited saves' },
  'pricing.perks.adsShown': { ko: '광고 노출', en: 'Ads shown' },
  'pricing.perks.adsRemoved': { ko: '광고 제거', en: 'Ads removed' },
  'pricing.perks.priorityQueue': { ko: '우선순위 큐', en: 'Priority queue' },
  'pricing.perks.categoryWeights': { ko: '카테고리 가중치', en: 'Category weighting' },
  'pricing.perks.weeklyReport': { ko: '주간 리포트', en: 'Weekly report' },
  'pricing.perks.topPriority': { ko: '최우선 처리', en: 'Top priority' },
  'pricing.perks.experimental': {
    ko: '실험 기능 우선 액세스',
    en: 'Early access to experiments',
  },
  'pricing.perks.apiBoost': { ko: 'API 호출 30%', en: '+30% API quota' },
  'pricing.badge.best': { ko: 'BEST', en: 'BEST' },
  'pricing.badge.current': { ko: '현재 플랜', en: 'Current' },
  'pricing.btn.current': { ko: '사용 중', en: 'Active' },
  'pricing.btn.choose': { ko: '선택하기', en: 'Choose' },
  'pricing.btn.a11y': { ko: '{name} 플랜 선택', en: 'Choose {name} plan' },
  'pricing.alreadyOnPlan.title': {
    ko: '이미 사용 중인 플랜이에요',
    en: 'You\'re already on this plan',
  },
  'pricing.alreadyOnPlan.body': {
    ko: '다른 플랜을 골라보세요.',
    en: 'Try picking a different plan.',
  },
  'pricing.changed.title': { ko: '플랜이 변경됐어요', en: 'Plan updated' },
  'pricing.changed.body': {
    ko: '{plan} 플랜으로 적용됩니다.',
    en: '{plan} plan is now active.',
  },
  'pricing.error.body': {
    ko: '플랜 변경에 실패했어요. 잠시 후 다시 시도해 주세요.',
    en: 'Could not change plan. Please try again in a moment.',
  },
  'pricing.note': {
    ko: '언제든지 플랜을 변경하거나 취소할 수 있어요. 같은 관심사를 검색하는 다른 사용자와 결과가 자동으로 공유되어 비용이 절감됩니다.',
    en: 'You can change or cancel anytime. Results are automatically shared across users searching the same interest, reducing cost.',
  },

  // ─── Auth (login / register) ───────────────────────────────────────
  'auth.login.title': { ko: '다시 만나서 반가워요', en: 'Welcome back' },
  'auth.login.subtitle': {
    ko: 'KeyP 계정으로 로그인하세요',
    en: 'Sign in to your KeyP account',
  },
  'auth.email': { ko: '이메일', en: 'Email' },
  'auth.password': { ko: '비밀번호', en: 'Password' },
  'auth.passwordPlaceholder': { ko: '비밀번호를 입력하세요', en: 'Enter your password' },
  'auth.forgot': { ko: '비밀번호 찾기', en: 'Forgot password' },
  'auth.forgot.title': { ko: '비밀번호 찾기', en: 'Forgot password' },
  'auth.forgot.body': {
    ko: '데모 앱입니다. demo@keyp.app / demo1234 로 로그인하세요.',
    en: 'Demo app — sign in with demo@keyp.app / demo1234.',
  },
  'auth.rememberMe': { ko: '로그인 상태 유지', en: 'Stay signed in' },
  'auth.login.btn': { ko: '로그인', en: 'Sign in' },
  'auth.or': { ko: '또는', en: 'or' },
  'auth.demo.btn': {
    ko: '데모 계정으로 빠르게 체험',
    en: 'Try with demo account',
  },
  'auth.noAccount': { ko: '아직 계정이 없으신가요?', en: 'Don\'t have an account?' },
  'auth.signup': { ko: '회원가입', en: 'Sign up' },
  'auth.invalidEmail': {
    ko: '올바른 이메일 형식이 아닙니다',
    en: 'Not a valid email address',
  },
  'auth.error.fields.title': { ko: '입력 오류', en: 'Missing fields' },
  'auth.error.fields.body': {
    ko: '이메일과 비밀번호를 모두 입력해주세요.',
    en: 'Please enter both email and password.',
  },
  'auth.error.email.title': { ko: '이메일 형식', en: 'Email format' },
  'auth.error.email.body': {
    ko: '올바른 이메일 주소를 입력해주세요.',
    en: 'Please enter a valid email address.',
  },
  'auth.error.password.title': { ko: '비밀번호', en: 'Password' },
  'auth.error.password.body': {
    ko: '비밀번호는 4자 이상이어야 합니다.',
    en: 'Password must be at least 4 characters.',
  },
  'auth.error.login.title': { ko: '로그인 실패', en: 'Sign in failed' },
  'auth.error.login.body': {
    ko: '이메일 또는 비밀번호를 확인해주세요.',
    en: 'Please check your email or password.',
  },
  'auth.social.comingSoon.title': { ko: '준비 중', en: 'Coming soon' },
  'auth.social.comingSoon.body': {
    ko: '{provider} 로그인은 곧 지원됩니다.',
    en: '{provider} sign-in will be supported soon.',
  },
  'auth.register.title': { ko: 'KeyP 시작하기', en: 'Get started with KeyP' },
  'auth.register.subtitle': {
    ko: '관심사를 등록하고 먼저 알림받으세요',
    en: 'Register interests and get alerts first',
  },
  'auth.register.nickname': { ko: '닉네임', en: 'Nickname' },
  'auth.register.passwordPlaceholder': {
    ko: '비밀번호 (6자 이상)',
    en: 'Password (6+ chars)',
  },
  'auth.register.terms.prefix': { ko: '가입하면 KeyP의', en: 'By signing up, you agree to KeyP\'s' },
  'auth.register.terms.tos': { ko: '이용약관', en: 'Terms' },
  'auth.register.terms.and': { ko: '과', en: 'and' },
  'auth.register.terms.privacy': { ko: '개인정보처리방침', en: 'Privacy Policy' },
  'auth.register.terms.suffix': { ko: '에 동의하게 됩니다.', en: '.' },
  'auth.register.btn': { ko: '계정 만들기', en: 'Create account' },
  'auth.register.error.fields.title': { ko: '입력 오류', en: 'Missing fields' },
  'auth.register.error.fields.body': {
    ko: '모든 항목을 입력해주세요.',
    en: 'Please fill in all fields.',
  },
  'auth.register.error.password.title': { ko: '비밀번호 오류', en: 'Password error' },
  'auth.register.error.password.body': {
    ko: '비밀번호는 6자 이상이어야 합니다.',
    en: 'Password must be at least 6 characters.',
  },
  'auth.register.error.fail.title': { ko: '회원가입 실패', en: 'Sign up failed' },
  'auth.register.error.fail.body': {
    ko: '잠시 후 다시 시도해주세요.',
    en: 'Please try again in a moment.',
  },
  'auth.register.haveAccount': { ko: '이미 계정이 있으신가요? ', en: 'Already have an account? ' },
  'auth.register.signin': { ko: '로그인', en: 'Sign in' },

  // ─── Pipeline fallback messages (shown in step list) ───────────────
  'pipeline.collectorFail': {
    ko: '서버 호출 실패 — 로컬 템플릿 사용',
    en: 'Server call failed — using local template',
  },
  'pipeline.verifierSkipped': { ko: '검증 건너뜀', en: 'Verification skipped' },
  'pipeline.delivererFallback': {
    ko: '{n}건 폴백 알림 생성',
    en: 'Generated {n} fallback alerts',
  },

  // ─── Not-found ─────────────────────────────────────────────────────
  'notFound.title': {
    ko: '존재하지 않는 화면입니다.',
    en: "This screen doesn't exist.",
  },
  'notFound.home': { ko: '홈으로 이동', en: 'Go to home' },
};

export function t(
  key: string,
  lang: Language,
  vars?: Record<string, string | number>,
): string {
  const entry = STRINGS[key];
  let raw: string;
  if (entry) {
    raw = entry[lang] ?? entry.ko ?? key;
  } else {
    raw = key;
  }
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? `{${name}}` : String(v);
  });
}
