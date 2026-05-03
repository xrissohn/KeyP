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
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '아직 없음';
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function InterestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  // Server-side cadence by plan (mirrors api-server/services/pollerCron.ts).
  // Falls back to the local foreground-refresh interval if plan is unknown.
  const PLAN_INTERVAL_MIN: Record<string, number> = {
    free: 60,
    basic: 15,
    pro: 10,
    power: 5,
  };
  const planMinutes =
    PLAN_INTERVAL_MIN[plan] ?? Math.round(autoCollectIntervalMs / 60_000);
  const intervalLabel = `${planMinutes}분마다`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>관심사</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {interests.length}개 등록 · {totalAlerts}개 알림
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/interest/add')}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

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
              {autoCollectEnabled ? `실시간 수집 · ${intervalLabel}` : '자동 수집 꺼짐'}
            </Text>
            <Text style={[styles.collectorSub, { color: colors.mutedForeground }]}>
              마지막 자동 수집: {relativeTime(lastBackgroundRunAt)}
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
              {isAnyRefreshing ? '수집 중' : '지금 수집'}
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
              title="관심사가 없어요"
              subtitle="자연어로 원하는 것을 설명하면 AI가 관심사를 구조화해드립니다"
              actionLabel="첫 관심사 등록"
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectorBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  collectorBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  collectorTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  collectorSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  collectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  refreshAllText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  list: {
    paddingHorizontal: 20,
  },
  emptyWrap: { height: 400 },
});
