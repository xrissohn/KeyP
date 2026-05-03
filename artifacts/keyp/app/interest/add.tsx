import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { AgentStep } from '@workspace/api-client-react';
import type { InterestSpec } from '@/types';

const AGENT_ORDER = ['Planner', 'SourceRouter', 'Collector', 'Verifier', 'Deliverer'];

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  reddit: 'Reddit',
  rss: 'RSS/뉴스',
  match: 'KeyP 매칭',
};

const EXAMPLE_KEYS = [
  'interest.add.example.0',
  'interest.add.example.1',
  'interest.add.example.2',
  'interest.add.example.3',
  'interest.add.example.4',
];

export default function AddInterestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { addInterest } = useApp();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'input' | 'analyzing' | 'result'>('input');
  const [spec, setSpec] = useState<InterestSpec | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const requestIdRef = useRef(0);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const myRequestId = ++requestIdRef.current;
    setPhase('analyzing');
    setSteps([]);
    try {
      const result = await addInterest(
        user?.id ?? 'guest',
        text.trim(),
        (incoming) => {
          if (requestIdRef.current === myRequestId) setSteps(incoming);
        }
      );
      if (requestIdRef.current !== myRequestId) return;
      setSpec(result.spec);
      setSteps(result.steps);
      setPhase('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (requestIdRef.current !== myRequestId) return;
      Alert.alert(t('common.error'), t('interest.add.error.body'));
      setPhase('input');
    }
  };

  const handleDone = () => {
    router.back();
  };

  const handleRetry = () => {
    requestIdRef.current++;
    setText('');
    setPhase('input');
    setSpec(null);
    setSteps([]);
  };

  // Build a server-driven step list. Use the canonical agent order as a hint to
  // place known agents in expected slots, but also append any unknown agents
  // emitted by the server so the UI never silently drops a step.
  const agentMeta = (agent: string): { label: string; desc: string } => {
    if (AGENT_ORDER.includes(agent)) {
      return {
        label: t(`interest.add.agent.${agent}.label`),
        desc: t(`interest.add.agent.${agent}.desc`),
      };
    }
    return { label: agent, desc: '' };
  };

  const buildStepList = (): { agent: string; completed?: AgentStep; meta: { label: string; desc: string } }[] => {
    const seen = new Set<string>();
    const out: { agent: string; completed?: AgentStep; meta: { label: string; desc: string } }[] = [];
    for (const agent of AGENT_ORDER) {
      const completed = steps.find((s) => s.agent === agent);
      out.push({ agent, completed, meta: agentMeta(agent) });
      seen.add(agent);
    }
    for (const s of steps) {
      if (!seen.has(s.agent)) {
        out.push({ agent: s.agent, completed: s, meta: agentMeta(s.agent) });
        seen.add(s.agent);
      }
    }
    return out;
  };

  const renderStepList = () => {
    const items = buildStepList();
    const completedCount = items.filter((i) => i.completed).length;
    return items.map(({ agent, completed, meta }, idx) => {
      const isFirstPending = !completed && idx === completedCount;
      const dotColor = completed
        ? completed.status === 'success'
          ? colors.success
          : completed.status === 'partial'
          ? colors.primary
          : colors.destructive ?? colors.primary
        : isFirstPending
        ? colors.primary
        : colors.border;
      return (
        <View
          key={agent}
          style={[styles.agentStep, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.stepDot, { backgroundColor: dotColor }]} />
          <View style={{ flex: 1 }}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepName, { color: colors.foreground }]}>{meta.label}</Text>
              {completed && completed.durationMs !== undefined && (
                <Text style={[styles.stepDuration, { color: colors.mutedForeground }]}>
                  {(completed.durationMs / 1000).toFixed(1)}s
                </Text>
              )}
            </View>
            <Text style={[styles.stepDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
              {completed?.message ?? meta.desc}
            </Text>
          </View>
        </View>
      );
    });
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
        <Text style={[styles.navTitle, { color: colors.foreground }]}>{t('interest.add.title')}</Text>
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
                {t('interest.add.intro.title')}
              </Text>
              <Text style={[styles.introSubtitle, { color: colors.mutedForeground }]}>
                {t('interest.add.intro.subtitle')}
              </Text>
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                placeholder={t('interest.add.placeholder')}
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
                    {t('interest.add.analyze')}
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
                {t('interest.add.examplesTitle')}
              </Text>
              <View style={styles.examples}>
                {EXAMPLE_KEYS.map((key) => {
                  const ex = t(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.exampleChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                      onPress={() => setText(ex)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.exampleText, { color: colors.foreground }]}>{ex}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {phase === 'analyzing' && (
          <View style={styles.analyzingSection}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.analyzingTitle, { color: colors.foreground }]}>
              {t('interest.add.analyzing.title')}
            </Text>
            <Text style={[styles.analyzingSubtitle, { color: colors.mutedForeground }]}>
              {t('interest.add.analyzing.subtitle', { done: steps.length, total: buildStepList().length })}
            </Text>
            <View style={styles.agentSteps}>{renderStepList()}</View>
          </View>
        )}

        {phase === 'result' && spec && (
          <View style={styles.resultSection}>
            <View style={[styles.successBadge, { backgroundColor: colors.success + '20' }]}>
              <Feather name="check-circle" size={20} color={colors.success} />
              <Text style={[styles.successText, { color: colors.success }]}>
                {t('interest.add.success', { ok: steps.filter((s) => s.status === 'success').length, total: steps.length })}
              </Text>
            </View>

            <View style={styles.agentSteps}>{renderStepList()}</View>

            <View style={[styles.specCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.specTitle, { color: colors.foreground }]}>
                "{spec.topic}"
              </Text>

              <View style={styles.specRows}>
                <SpecRow label={t('interest.add.spec.intent')} value={t(`intent.${spec.intentType}`)} colors={colors} />
                <SpecRow label={t('interest.add.spec.urgency')} value={t(`urgency.${spec.urgency}`)} colors={colors} />
                {spec.locationScope && (
                  <SpecRow label={t('interest.add.spec.region')} value={spec.locationScope} colors={colors} />
                )}
                <SpecRow label={t('interest.add.spec.goal')} value={spec.desiredOutcome} colors={colors} />
              </View>

              {spec.entities.length > 0 && (
                <View style={styles.entitiesRow}>
                  <Text style={[styles.entitiesLabel, { color: colors.mutedForeground }]}>{t('interest.add.spec.entities')}</Text>
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
                <Text style={[styles.entitiesLabel, { color: colors.mutedForeground }]}>{t('interest.add.spec.sourcesPriority')}</Text>
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
                <Text style={[styles.retryText, { color: colors.mutedForeground }]}>{t('interest.add.retry')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                onPress={handleDone}
                activeOpacity={0.85}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.doneBtnText}>{t('interest.add.done')}</Text>
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
  analyzingSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  agentSteps: { gap: 10, width: '100%' },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepDuration: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
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
