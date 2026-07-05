import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import InterestCard from '@/components/InterestCard';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { relativeTime } from '@/lib/i18n';
import { planInterestCap } from '@/lib/planLimits';

export default function InterestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, t } = useI18n();
  const {
    interests,
    deleteInterest,
    alerts,
    refreshAllInterests,
    refreshingInterestIds,
    autoCollectEnabled,
    setAutoCollectEnabled,
    autoCollectIntervalMs,
    lastBackgroundRunAt,
    plan,
  } = useApp();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const totalAlerts = alerts.length;
  const isAnyRefreshing = refreshingInterestIds.length > 0;
  const interestCap = planInterestCap(plan);
  const usage = interests.length;
  const atCap = usage >= interestCap;
  const usageColor = atCap
    ? colors.destructive ?? '#FF6B8A'
    : usage >= interestCap - 1
    ? '#FBBF24'
    : colors.mutedForeground;
  const PLAN_INTERVAL_MIN: Record<string, number> = {
    free: 60,
    basic: 15,
    pro: 10,
    power: 5,
  };
  const planMinutes =
    PLAN_INTERVAL_MIN[plan] ?? Math.round(autoCollectIntervalMs / 60_000);
  const intervalLabel = t('interests.intervalEvery', { n: planMinutes });
  const lastAutoLabel = lastBackgroundRunAt
    ? relativeTime(Date.now() - new Date(lastBackgroundRunAt).getTime(), language)
    : t('common.never');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>{t('interests.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t('interests.subtitle', { n: interests.length, m: totalAlerts })}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.usagePill,
              {
                backgroundColor: colors.card,
                borderColor: atCap ? usageColor : colors.border,
              },
            ]}
            accessibilityLabel={t('interests.usage.a11y', {
              n: usage,
              m: interestCap,
            })}
          >
            <Feather name="layers" size={11} color={usageColor} />
            <Text style={[styles.usagePillText, { color: usageColor }]}>
              {usage}/{interestCap}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: atCap ? colors.muted : colors.primary,
                opacity: atCap ? 0.6 : 1,
              },
            ]}
            onPress={() => router.push('/interest/add')}
            activeOpacity={0.85}
            accessibilityState={{ disabled: atCap }}
          >
            <Feather name="plus" size={20} color={atCap ? colors.mutedForeground : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>
      {atCap && (
        <View
          style={[
            styles.capBanner,
            {
              backgroundColor: (colors.destructive ?? '#FF6B8A') + '14',
              borderColor: (colors.destructive ?? '#FF6B8A') + '40',
            },
          ]}
        >
          <Feather name="alert-circle" size={13} color={colors.destructive ?? '#FF6B8A'} />
          <Text style={[styles.capBannerText, { color: colors.foreground }]}>
            {t('interests.cap.banner', { limit: interestCap })}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.collectorBar,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.collectorBarLeft}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: autoCollectEnabled ? '#22C55E' : '#9CA3AF' },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.collectorTitle, { color: colors.foreground }]}>
              {autoCollectEnabled
                ? t('interests.realtime', { label: intervalLabel })
                : t('interests.autoOff')}
            </Text>
            <Text style={[styles.collectorSub, { color: colors.mutedForeground }]}>
              {t('interests.lastAuto', { t: lastAutoLabel })}
            </Text>
          </View>
        </View>
        <View style={styles.collectorActions}>
          <TouchableOpacity
            onPress={() => refreshAllInterests()}
            disabled={isAnyRefreshing || interests.length === 0}
            style={[
              styles.refreshAllBtn,
              {
                backgroundColor: colors.primary + '15',
                borderColor: colors.primary + '40',
                opacity: isAnyRefreshing || interests.length === 0 ? 0.5 : 1,
              },
            ]}
            activeOpacity={0.8}
          >
            {isAnyRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="refresh-cw" size={14} color={colors.primary} />
            )}
            <Text style={[styles.refreshAllText, { color: colors.primary }]}>
              {isAnyRefreshing ? t('interests.refreshing') : t('interests.refreshNow')}
            </Text>
          </TouchableOpacity>
          <Switch
            value={autoCollectEnabled}
            onValueChange={setAutoCollectEnabled}
            trackColor={{ false: '#9CA3AF', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <FlatList
        data={interests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InterestCard interest={item} onDelete={deleteInterest} />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomInset + 84 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="star"
              title={t('interests.empty.title')}
              subtitle={t('interests.empty.subtitle')}
              actionLabel={t('interests.empty.action')}
              onAction={() => router.push('/interest/add')}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usagePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  usagePillText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  capBanner: { marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  capBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 16 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  collectorBar: { marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  collectorBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  collectorTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  collectorSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  collectorActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  refreshAllText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  list: { paddingHorizontal: 20 },
  emptyWrap: { height: 400 },
});
