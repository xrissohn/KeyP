import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Alert as RNAlert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AlertCard from '@/components/AlertCard';
import EmptyState from '@/components/EmptyState';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { relativeTime as relTime, t as translate, type Language } from '@/lib/i18n';

function fmtRelative(iso: string | null | undefined, lang: Language): string {
  if (!iso) return translate('common.none', lang);
  return relTime(Date.now() - new Date(iso).getTime(), lang);
}

export default function InterestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    interests,
    alerts,
    deleteInterest,
    markInterestViewed,
    getNewAlertCount,
    refreshInterest,
    refreshingInterestIds,
    autoCollectEnabled,
    plan,
    boostInterest,
  } = useApp();
  const isRefreshing = id ? refreshingInterestIds.includes(id) : false;
  const [isBoosting, setIsBoosting] = useState(false);
  const boostEligible = plan === 'pro' || plan === 'power';
  const { t, language } = useI18n();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const interest = interests.find((i) => i.id === id);
  const interestAlerts = alerts
    .filter((a) => a.interestId === id)
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const newCount = id ? getNewAlertCount(id) : 0;

  useEffect(() => {
    if (id && interest && newCount > 0) {
      // Defer so the NEW indicator stays visible briefly before being cleared.
      const t = setTimeout(() => markInterestViewed(id), 600);
      return () => clearTimeout(t);
    }
  }, [id, interest, newCount, markInterestViewed]);

  if (!interest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ textAlign: 'center', marginTop: 100, color: colors.mutedForeground }}>
          {t('interest.detail.notFound')}
        </Text>
      </View>
    );
  }

  const spec = interest.spec;

  const onPressBoost = async () => {
    if (!id || isBoosting) return;
    if (!boostEligible) {
      RNAlert.alert(
        t('interest.detail.boostPlan.title'),
        t('interest.detail.boostPlan.body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('interest.detail.boostPlan.viewPricing'), onPress: () => router.push('/pricing') },
        ],
      );
      return;
    }
    setIsBoosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const r = await boostInterest(id);
      if (Platform.OS !== 'web') {
        if (r.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          RNAlert.alert(
            t('interest.detail.boostDone.title'),
            t('interest.detail.boostDone.body', { remaining: r.remaining, quota: r.quota }),
          );
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          const msg =
            r.reason === 'quota'
              ? t('interest.detail.boostFail.quota', { used: r.used, quota: r.quota })
              : r.reason === 'plan'
                ? t('interest.detail.boostFail.plan')
                : t('interest.detail.boostFail.generic');
          RNAlert.alert(t('interest.detail.boostFail.title'), msg);
        }
      }
    } catch {
      if (Platform.OS !== 'web') {
        RNAlert.alert(t('common.error'), t('interest.detail.boostError'));
      }
    } finally {
      setIsBoosting(false);
    }
  };

  const onPressRefresh = async () => {
    if (!id || isRefreshing) return;
    const result = await refreshInterest(id);
    if (Platform.OS !== 'web') {
      const msg =
        result.newAlertCount > 0
          ? t('interest.detail.refreshNew', { n: result.newAlertCount })
          : result.totalCollected === 0
            ? t('interest.detail.refreshCooldown')
            : t('interest.detail.refreshNoNew');
      RNAlert.alert(t('interest.detail.refreshTitle'), msg);
    }
  };

  const renderHeader = () => (
    <View>
      <View style={[styles.heroCard, { backgroundColor: interest.color + '15', borderColor: interest.color + '40' }]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroEmoji}>{interest.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>{interest.displayName}</Text>
            <View style={[styles.intentBadge, { backgroundColor: interest.color + '30' }]}>
              <Text style={[styles.intentText, { color: interest.color }]}>
                {t(`intent.${spec.intentType}`)}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.rawText, { color: colors.mutedForeground }]}>"{spec.rawText}"</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statItem, { borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: interest.color }]}>{interest.alertCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t('interest.detail.statTotal')}</Text>
          </View>
          <View style={[styles.statItem, { borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: interest.color }]}>
              {t(`urgency.${spec.urgency}`)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t('interest.detail.statUrgency')}</Text>
          </View>
          <View style={[styles.statItem, { borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: interest.color }]}>
              {t(`privacy.${spec.privacyLevel}`)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t('interest.detail.statPrivacy')}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.specSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t('interest.detail.aiTitle')}</Text>
        <View style={styles.specRow}>
          <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>{t('interest.detail.goal')}</Text>
          <Text style={[styles.specValue, { color: colors.foreground }]}>{spec.desiredOutcome}</Text>
        </View>
        {spec.locationScope && (
          <View style={styles.specRow}>
            <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>{t('interest.detail.region')}</Text>
            <Text style={[styles.specValue, { color: colors.foreground }]}>{spec.locationScope}</Text>
          </View>
        )}
        <View style={styles.sourcesLabel}>
          <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>{t('interest.detail.sources')}</Text>
        </View>
        <View style={styles.sources}>
          {spec.suggestedSources.map((src, i) => (
            <View key={src} style={[styles.sourceChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.sourceRank, { color: colors.primary }]}>{i + 1}</Text>
              <Text style={[styles.sourceText, { color: colors.foreground }]}>
                {t(`source.${src}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.collectStatus, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.collectStatusLeft}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: autoCollectEnabled ? '#22C55E' : '#9CA3AF' },
            ]}
          />
          <View>
            <Text style={[styles.collectStatusTitle, { color: colors.foreground }]}>
              {autoCollectEnabled ? t('interest.detail.realtime') : t('interest.detail.autoOff')}
            </Text>
            <Text style={[styles.collectStatusSub, { color: colors.mutedForeground }]}>
              {t('interest.detail.lastCollect', { t: fmtRelative(interest.lastRefreshedAt, language) })}
            </Text>
          </View>
        </View>
        <View style={styles.actionBtnRow}>
          <TouchableOpacity
            onPress={onPressBoost}
            disabled={isBoosting || isRefreshing}
            style={[
              styles.refreshBtn,
              {
                backgroundColor: isBoosting ? colors.secondary : '#EF444420',
                borderColor: '#EF444450',
                opacity: isBoosting || isRefreshing ? 0.6 : 1,
              },
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="속보 즉시 갱신"
          >
            {isBoosting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Feather name="zap" size={14} color="#EF4444" />
            )}
            <Text style={[styles.refreshBtnText, { color: '#EF4444' }]}>
              {isBoosting ? t('interest.detail.boosting') : t('interest.detail.boost')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPressRefresh}
            disabled={isRefreshing || isBoosting}
            style={[
              styles.refreshBtn,
              {
                backgroundColor: isRefreshing ? colors.secondary : interest.color + '20',
                borderColor: interest.color + '50',
                opacity: isRefreshing || isBoosting ? 0.6 : 1,
              },
            ]}
            activeOpacity={0.8}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={interest.color} />
            ) : (
              <Feather name="refresh-cw" size={14} color={interest.color} />
            )}
            <Text style={[styles.refreshBtnText, { color: interest.color }]}>
              {isRefreshing ? t('interest.detail.refreshing') : t('interest.detail.refresh')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {interestAlerts.length > 0 && (
        <View style={styles.alertsHeaderRow}>
          <Text style={[styles.alertsHeader, { color: colors.foreground }]}>
            {t('interest.detail.alertHistory', { n: interestAlerts.length })}
          </Text>
          {newCount > 0 && (
            <View style={[styles.newPill, { backgroundColor: colors.destructive ?? '#EF4444' }]}>
              <Text style={styles.newPillText}>NEW {newCount}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>관심사 상세</Text>
        <TouchableOpacity
          onPress={() => {
            deleteInterest(interest.id);
            router.back();
          }}
          style={[styles.deleteBtn, { backgroundColor: colors.destructive + '20' }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={interestAlerts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => <AlertCard alert={item} showInterestTag={false} />}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 24 }]}
        ListEmptyComponent={
          interestAlerts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="bell"
                title="알림 수집 중"
                subtitle="AI 에이전트가 관련 소식을 찾고 있어요. 잠시 후 알림이 도착합니다."
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}

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
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
    gap: 4,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  intentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  intentText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  rawText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRightWidth: 1,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  specSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  specRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  specLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    width: 64,
    flexShrink: 0,
  },
  specValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  sourcesLabel: { marginTop: 4 },
  sources: { gap: 6 },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sourceRank: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    width: 18,
  },
  sourceText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  alertsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  alertsHeader: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  newPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  newPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  collectStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  collectStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  collectStatusTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  collectStatusSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  refreshBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyWrap: { height: 300 },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
});
