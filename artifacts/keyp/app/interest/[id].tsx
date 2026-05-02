import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AlertCard from '@/components/AlertCard';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const INTENT_LABELS: Record<string, string> = {
  monitor: '모니터링',
  alert: '알림',
  opportunity: '기회탐지',
  match: '매칭',
  creator_watch: '크리에이터',
  travel: '여행',
  local_signal: '로컬',
};

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  reddit: 'Reddit',
  rss: 'RSS/뉴스',
  match: 'KeyP 매칭',
};

export default function InterestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { interests, alerts, deleteInterest, markInterestViewed, getNewAlertCount } = useApp();

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
          관심사를 찾을 수 없습니다
        </Text>
      </View>
    );
  }

  const spec = interest.spec;

  const renderHeader = () => (
    <View>
      <View style={[styles.heroCard, { backgroundColor: interest.color + '15', borderColor: interest.color + '40' }]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroEmoji}>{interest.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>{interest.displayName}</Text>
            <View style={[styles.intentBadge, { backgroundColor: interest.color + '30' }]}>
              <Text style={[styles.intentText, { color: interest.color }]}>
                {INTENT_LABELS[spec.intentType] ?? spec.intentType}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.rawText, { color: colors.mutedForeground }]}>"{spec.rawText}"</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statItem, { borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: interest.color }]}>{interest.alertCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>총 알림</Text>
          </View>
          <View style={[styles.statItem, { borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: interest.color }]}>
              {spec.urgency === 'high' ? '긴급' : spec.urgency === 'medium' ? '보통' : '낮음'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>긴급도</Text>
          </View>
          <View style={[styles.statItem, { borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: interest.color }]}>
              {spec.privacyLevel === 'public' ? '공개' : spec.privacyLevel === 'friends' ? '친구' : '비공개'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>공개범위</Text>
          </View>
        </View>
      </View>

      <View style={[styles.specSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>AI 분석 결과</Text>
        <View style={styles.specRow}>
          <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>목표</Text>
          <Text style={[styles.specValue, { color: colors.foreground }]}>{spec.desiredOutcome}</Text>
        </View>
        {spec.locationScope && (
          <View style={styles.specRow}>
            <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>지역</Text>
            <Text style={[styles.specValue, { color: colors.foreground }]}>{spec.locationScope}</Text>
          </View>
        )}
        <View style={styles.sourcesLabel}>
          <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>수집 소스</Text>
        </View>
        <View style={styles.sources}>
          {spec.suggestedSources.map((src, i) => (
            <View key={src} style={[styles.sourceChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.sourceRank, { color: colors.primary }]}>{i + 1}</Text>
              <Text style={[styles.sourceText, { color: colors.foreground }]}>
                {SOURCE_LABELS[src] ?? src}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {interestAlerts.length > 0 && (
        <View style={styles.alertsHeaderRow}>
          <Text style={[styles.alertsHeader, { color: colors.foreground }]}>
            알림 히스토리 {interestAlerts.length}개
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
  emptyWrap: { height: 300 },
});
