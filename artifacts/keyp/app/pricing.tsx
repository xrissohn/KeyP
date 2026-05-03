import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, type PlanTier } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface PlanDef {
  id: PlanTier;
  name: string;
  monthly: number;
  tagline: string;
  pollLabel: string;
  interestCap: string;
  boostLabel: string;
  perks: string[];
  highlight?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0,
    tagline: '체험용',
    pollLabel: '1시간 주기',
    interestCap: '관심사 1개',
    boostLabel: '속보 알림 없음',
    perks: ['기본 알림', '저장 5건', '광고 노출'],
  },
  {
    id: 'basic',
    name: 'Basic',
    monthly: 4900,
    tagline: '입문',
    pollLabel: '15분 주기',
    interestCap: '관심사 5개',
    boostLabel: '속보 알림 없음',
    perks: ['기본 알림', '저장 무제한', '광고 제거'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 12900,
    tagline: '추천',
    pollLabel: '10분 주기',
    interestCap: '관심사 15개',
    boostLabel: '속보 알림 월 5회',
    perks: ['우선순위 큐', '카테고리 가중치', '주간 리포트'],
    highlight: true,
  },
  {
    id: 'power',
    name: 'Power',
    monthly: 29900,
    tagline: '파워유저',
    pollLabel: '5분 주기',
    interestCap: '관심사 30개',
    boostLabel: '속보 알림 월 30회',
    perks: ['최우선 처리', '실험 기능 우선 액세스', 'API 호출 30%'],
  },
];

function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan: currentPlan, annualBilling, setPlan } = useApp();
  const [annual, setAnnual] = useState(annualBilling);
  const [submittingId, setSubmittingId] = useState<PlanTier | null>(null);

  const topInset = Platform.OS === 'web' ? 24 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 24 : insets.bottom;

  const annualMultiplier = 0.8;

  const computedPlans = useMemo(
    () =>
      PLANS.map((p) => {
        const monthly = annual ? Math.round((p.monthly * annualMultiplier) / 100) * 100 : p.monthly;
        const yearly = monthly * 12;
        return { ...p, displayMonthly: monthly, displayYearly: yearly };
      }),
    [annual],
  );

  const handleSelect = async (next: PlanTier) => {
    if (submittingId) return;
    if (next === currentPlan && annual === annualBilling) {
      Alert.alert('이미 사용 중인 플랜이에요', '다른 플랜을 골라보세요.');
      return;
    }
    setSubmittingId(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await setPlan(next, annual);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('플랜이 변경됐어요', `${next.toUpperCase()} 플랜으로 적용됩니다.`);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('오류', '플랜 변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topInset + 8, paddingBottom: bottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>요금제</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          더 빠른 폴링과 속보 알림으로 관심사를 놓치지 마세요.
        </Text>

        {/* 월/연간 토글 */}
        <View style={[styles.cycleToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { key: false, label: '월간' },
            { key: true, label: '연간 -20%' },
          ].map((opt) => {
            const active = annual === opt.key;
            return (
              <Pressable
                key={String(opt.key)}
                onPress={() => setAnnual(opt.key)}
                style={[
                  styles.cycleOption,
                  active && { backgroundColor: colors.primary },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.cycleText,
                    { color: active ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 플랜 카드들 */}
        <View style={styles.planList}>
          {computedPlans.map((p) => {
            const isCurrent = p.id === currentPlan;
            const isSubmitting = submittingId === p.id;
            const isHighlight = p.highlight;
            const borderColor = isHighlight ? colors.primary : colors.border;
            return (
              <View
                key={p.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor,
                    borderWidth: isHighlight ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.planHeader}>
                  <View>
                    <Text style={[styles.planName, { color: colors.foreground }]}>{p.name}</Text>
                    <Text style={[styles.planTagline, { color: colors.mutedForeground }]}>
                      {p.tagline}
                    </Text>
                  </View>
                  {isHighlight && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>BEST</Text>
                    </View>
                  )}
                  {isCurrent && !isHighlight && (
                    <View style={[styles.badge, { backgroundColor: colors.success }]}>
                      <Text style={styles.badgeText}>현재 플랜</Text>
                    </View>
                  )}
                </View>

                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.foreground }]}>
                    {p.monthly === 0 ? '무료' : `₩${formatKRW(p.displayMonthly)}`}
                  </Text>
                  {p.monthly > 0 && (
                    <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}>
                      /월
                    </Text>
                  )}
                </View>
                {annual && p.monthly > 0 && (
                  <Text style={[styles.yearlyHint, { color: colors.mutedForeground }]}>
                    연 ₩{formatKRW(p.displayYearly)} 일시 결제
                  </Text>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.featureList}>
                  <FeatureRow icon="refresh-cw" text={p.pollLabel} colors={colors} />
                  <FeatureRow icon="star" text={p.interestCap} colors={colors} />
                  <FeatureRow icon="zap" text={p.boostLabel} colors={colors} />
                  {p.perks.map((perk) => (
                    <FeatureRow key={perk} icon="check" text={perk} colors={colors} />
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.selectBtn,
                    {
                      backgroundColor: isCurrent
                        ? colors.secondary
                        : isHighlight
                        ? colors.primary
                        : colors.foreground,
                    },
                  ]}
                  onPress={() => handleSelect(p.id)}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name} 플랜 선택`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={isCurrent ? colors.foreground : '#fff'} />
                  ) : (
                    <Text
                      style={[
                        styles.selectText,
                        {
                          color: isCurrent
                            ? colors.foreground
                            : isHighlight
                            ? '#fff'
                            : colors.background,
                        },
                      ]}
                    >
                      {isCurrent ? '사용 중' : '선택하기'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={[styles.note, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            언제든지 플랜을 변경하거나 취소할 수 있어요. 같은 관심사를 검색하는 다른 사용자와
            결과가 자동으로 공유되어 비용이 절감됩니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

interface FeatureRowProps {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  colors: ReturnType<typeof useColors>;
}

function FeatureRow({ icon, text, colors }: FeatureRowProps) {
  return (
    <View style={styles.feature}>
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={[styles.featureText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  cycleToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  cycleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  cycleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  planList: { gap: 12 },
  planCard: {
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  planName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  planTagline: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { fontSize: 30, fontFamily: 'Inter_700Bold' },
  priceUnit: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  yearlyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: -6 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  featureList: { gap: 8 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  selectBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  selectText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  note: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
});
