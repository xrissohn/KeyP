import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { InterestSpec } from '@/types';

const INTENT_LABELS: Record<string, string> = {
  monitor: '모니터링',
  alert: '알림',
  opportunity: '기회탐지',
  match: '매칭',
  creator_watch: '크리에이터',
  travel: '여행',
  local_signal: '로컬',
};

const URGENCY_LABELS: Record<string, string> = {
  high: '긴급',
  medium: '보통',
  low: '낮음',
};

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  reddit: 'Reddit',
  rss: 'RSS/뉴스',
  match: 'KeyP 매칭',
};

const EXAMPLES = [
  '방탄소년단 콘서트 일정 알려줘',
  '다음 달 뉴욕 여행 정보 + 현지 동행자 찾고 싶어',
  '국내 AI 스타트업 투자 기회 탐지해줘',
  '호날두 최신 경기 소식 + 기록 업데이트',
  '서울 힙한 카페 오픈 소식 모니터링',
];

export default function AddInterestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { addInterest } = useApp();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'input' | 'analyzing' | 'result'>('input');
  const [spec, setSpec] = useState<InterestSpec | null>(null);
  const [saving, setSaving] = useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase('analyzing');
    try {
      const result = await addInterest(user?.id ?? 'guest', text.trim());
      setSpec(result);
      setPhase('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('오류', '분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      setPhase('input');
    }
  };

  const handleDone = () => {
    router.back();
  };

  const handleRetry = () => {
    setText('');
    setPhase('input');
    setSpec(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>관심사 등록</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {phase === 'input' && (
          <>
            <View style={styles.introSection}>
              <View style={[styles.aiIcon, { backgroundColor: colors.primary + '20' }]}>
                <Feather name="cpu" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.introTitle, { color: colors.foreground }]}>
                관심사를 자연어로 입력하세요
              </Text>
              <Text style={[styles.introSubtitle, { color: colors.mutedForeground }]}>
                AI 플래너 에이전트가 분석해 최적의 소스를 찾아드립니다
              </Text>
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                placeholder="예) 다음 달 도쿄 여행 정보 + 현지 맛집, BTS 월드투어 일정..."
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
              <View style={[styles.inputFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                  {text.length}/300
                </Text>
                <TouchableOpacity
                  style={[
                    styles.analyzeBtn,
                    { backgroundColor: text.trim() ? colors.primary : colors.secondary },
                  ]}
                  onPress={handleAnalyze}
                  disabled={!text.trim()}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.analyzeBtnText,
                      { color: text.trim() ? '#fff' : colors.mutedForeground },
                    ]}
                  >
                    AI 분석
                  </Text>
                  <Feather
                    name="zap"
                    size={14}
                    color={text.trim() ? '#fff' : colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.examplesSection}>
              <Text style={[styles.examplesTitle, { color: colors.mutedForeground }]}>
                예시
              </Text>
              <View style={styles.examples}>
                {EXAMPLES.map((ex) => (
                  <TouchableOpacity
                    key={ex}
                    style={[styles.exampleChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    onPress={() => setText(ex)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.exampleText, { color: colors.foreground }]}>{ex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {phase === 'analyzing' && (
          <View style={styles.analyzingSection}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.analyzingTitle, { color: colors.foreground }]}>
              AI 에이전트 분석 중...
            </Text>
            <View style={styles.agentSteps}>
              {[
                { step: 'PlannerAgent', desc: '관심사 구조화 중' },
                { step: 'SourceRouterAgent', desc: '최적 소스 선정 중' },
                { step: 'ScoutAgent', desc: '수집 준비 중' },
              ].map((a, i) => (
                <View key={a.step} style={[styles.agentStep, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.stepDot, { backgroundColor: i === 0 ? colors.primary : colors.border }]} />
                  <View>
                    <Text style={[styles.stepName, { color: colors.foreground }]}>{a.step}</Text>
                    <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>{a.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {phase === 'result' && spec && (
          <View style={styles.resultSection}>
            <View style={[styles.successBadge, { backgroundColor: colors.success + '20' }]}>
              <Feather name="check-circle" size={20} color={colors.success} />
              <Text style={[styles.successText, { color: colors.success }]}>분석 완료 · 수집 시작</Text>
            </View>

            <View style={[styles.specCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.specTitle, { color: colors.foreground }]}>
                "{spec.topic}"
              </Text>

              <View style={styles.specRows}>
                <SpecRow label="의도 유형" value={INTENT_LABELS[spec.intentType] ?? spec.intentType} colors={colors} />
                <SpecRow label="긴급도" value={URGENCY_LABELS[spec.urgency]} colors={colors} />
                {spec.locationScope && (
                  <SpecRow label="지역 범위" value={spec.locationScope} colors={colors} />
                )}
                <SpecRow label="목표" value={spec.desiredOutcome} colors={colors} />
              </View>

              {spec.entities.length > 0 && (
                <View style={styles.entitiesRow}>
                  <Text style={[styles.entitiesLabel, { color: colors.mutedForeground }]}>키 엔티티</Text>
                  <View style={styles.tags}>
                    {spec.entities.slice(0, 5).map((e) => (
                      <View key={e} style={[styles.tag, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.tagText, { color: colors.primary }]}>{e}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.sourcesRow}>
                <Text style={[styles.entitiesLabel, { color: colors.mutedForeground }]}>수집 소스 우선순위</Text>
                <View style={styles.sources}>
                  {spec.suggestedSources.map((src, i) => (
                    <View key={src} style={[styles.sourceItem, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.sourceRank, { color: colors.primary }]}>{i + 1}</Text>
                      <Text style={[styles.sourceText, { color: colors.foreground }]}>
                        {SOURCE_LABELS[src] ?? src}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.retryBtn, { borderColor: colors.border }]}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
                <Text style={[styles.retryText, { color: colors.mutedForeground }]}>다시 입력</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                onPress={handleDone}
                activeOpacity={0.85}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.doneBtnText}>피드 확인하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SpecRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View style={specStyles.row}>
      <Text style={[specStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[specStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const specStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    width: 80,
    flexShrink: 0,
  },
  value: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 24,
  },
  introSection: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  aiIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  introTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  textInput: {
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 120,
    lineHeight: 22,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  analyzeBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  examplesSection: { gap: 10 },
  examplesTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  examples: { gap: 8 },
  exampleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  analyzingSection: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 40,
  },
  analyzingTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  agentSteps: { gap: 10, width: '100%' },
  agentStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  stepDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  resultSection: { gap: 16 },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  successText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  specCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  specTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    lineHeight: 26,
  },
  specRows: { gap: 2 },
  entitiesRow: { gap: 8 },
  entitiesLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  sourcesRow: { gap: 8 },
  sources: { gap: 6 },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sourceRank: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    width: 20,
  },
  sourceText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  doneBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
