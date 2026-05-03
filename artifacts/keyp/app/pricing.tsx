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
import { useApp, useI18n, type PlanTier } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface PlanDef {
  id: PlanTier;
  name: string;
  monthly: number;
  taglineKey: string;
  pollKey: string;
  capKey: string;
  boostKey: string;
  perkKeys: string[];
  highlight?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0,
    taglineKey: 'pricing.tagline.free',
    pollKey: 'pricing.poll.free',
    capKey: 'pricing.cap.free',
    boostKey: 'pricing.boost.free',
    perkKeys: ['pricing.perks.basicAlert', 'pricing.perks.savedFew', 'pricing.perks.adsShown'],
  },
  {
    id: 'basic',
    name: 'Basic',
    monthly: 4900,
    taglineKey: 'pricing.tagline.basic',
    pollKey: 'pricing.poll.basic',
    capKey: 'pricing.cap.basic',
    boostKey: 'pricing.boost.basic',
    perkKeys: ['pricing.perks.basicAlert', 'pricing.perks.savedUnlimited', 'pricing.perks.adsRemoved'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 12900,
    taglineKey: 'pricing.tagline.pro',
    pollKey: 'pricing.poll.pro',
    capKey: 'pricing.cap.pro',
    boostKey: 'pricing.boost.pro',
    perkKeys: ['pricing.perks.priorityQueue', 'pricing.perks.categoryWeights', 'pricing.perks.weeklyReport'],
    highlight: true,
  },
  {
    id: 'power',
    name: 'Power',
    monthly: 29900,
    taglineKey: 'pricing.tagline.power',
    pollKey: 'pricing.poll.power',
    capKey: 'pricing.cap.power',
    boostKey: 'pricing.boost.power',
    perkKeys: ['pricing.perks.topPriority', 'pricing.perks.experimental', 'pricing.perks.apiBoost'],
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
  const { t } = useI18n();
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
    if (next !== 'free') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert(t('pricing.comingSoon.title'), t('pricing.comingSoon.body'));
      return;
    }
    if (next === currentPlan && annual === annualBilling) {
      Alert.alert(t('pricing.alreadyOnPlan.title'), t('pricing.alreadyOnPlan.body'));
      return;
    }
    setSubmittingId(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await setPlan(next, annual);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t('pricing.changed.title'), t('pricing.changed.body', { plan: next.toUpperCase() }));
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(t('common.error'), t('pricing.error.body'));
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
            accessibilityLabel={t('common.back')}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>{t('pricing.title')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t('pricing.subtitle')}
        </Text>

        {/* 월/연간 토글 */}
        <View style={[styles.cycleToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { key: false, label: t('pricing.monthly') },
            { key: true, label: t('pricing.annualMinus20') },
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
            const isComingSoon = p.id !== 'free';
            const borderColor = isComingSoon
              ? colors.border
              : isHighlight
              ? colors.primary
              : colors.border;
            return (
              <View
                key={p.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor,
                    borderWidth: isHighlight && !isComingSoon ? 2 : 1,
                    opacity: isComingSoon ? 0.62 : 1,
                  },
                ]}
              >
                <View style={styles.planHeader}>
                  <View>
                    <Text style={[styles.planName, { color: colors.foreground }]}>{p.name}</Text>
                    <Text style={[styles.planTagline, { color: colors.mutedForeground }]}>
                      {t(p.taglineKey)}
                    </Text>
                  </View>
                  {isComingSoon ? (
                    <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.badgeText, { color: colors.foreground }]}>
                        {t('pricing.comingSoon.badge')}
                      </Text>
                    </View>
                  ) : isHighlight ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>BEST</Text>
                    </View>
                  ) : isCurrent ? (
                    <View style={[styles.badge, { backgroundColor: colors.success }]}>
                      <Text style={styles.badgeText}>{t('pricing.badge.current')}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.foreground }]}>
                    {p.monthly === 0 ? t('pricing.free') : `₩${formatKRW(p.displayMonthly)}`}
                  </Text>
                  {p.monthly > 0 && (
                    <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}>
                      {t('pricing.perMonth')}
                    </Text>
                  )}
                </View>
                {annual && p.monthly > 0 && (
                  <Text style={[styles.yearlyHint, { color: colors.mutedForeground }]}>
                    {t('pricing.yearlyHint', { amount: formatKRW(p.displayYearly) })}
                  </Text>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.featureList}>
                  <FeatureRow icon="refresh-cw" text={t(p.pollKey)} colors={colors} />
                  <FeatureRow icon="star" text={t(p.capKey)} colors={colors} />
                  <FeatureRow icon="zap" text={t(p.boostKey)} colors={colors} />
                  {p.perkKeys.map((perkKey) => (
                    <FeatureRow key={perkKey} icon="check" text={t(perkKey)} colors={colors} />
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.selectBtn,
                    {
                      backgroundColor: isComingSoon
                        ? colors.muted
                        : isCurrent
                        ? colors.secondary
                        : isHighlight
                        ? colors.primary
                        : colors.foreground,
                    },
                  ]}
                  onPress={() => handleSelect(p.id)}
                  disabled={isSubmitting || isComingSoon}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('pricing.btn.a11y', { name: p.name })}
                  accessibilityState={{ disabled: isComingSoon }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={isCurrent ? colors.foreground : '#fff'} />
                  ) : (
                    <Text
                      style={[
                        styles.selectText,
                        {
                          color: isComingSoon
                            ? colors.mutedForeground
                            : isCurrent
                            ? colors.foreground
                            : isHighlight
                            ? '#fff'
                            : colors.background,
                        },
                      ]}
                    >
                      {isComingSoon
                        ? t('pricing.comingSoon.btn')
                        : isCurrent
                        ? t('pricing.btn.current')
                        : t('pricing.btn.choose')}
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
            {t('pricing.note')}
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
