import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Interest } from '@/types';

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
  youtube: 'YT',
  twitter: 'X',
  reddit: 'RD',
  rss: 'RSS',
  match: '매칭',
};

interface Props {
  interest: Interest;
  onDelete?: (id: string) => void;
}

export default function InterestCard({ interest, onDelete }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { getNewAlertCount } = useApp();
  const newCount = getNewAlertCount(interest.id);

  const handlePress = () => {
    router.push({ pathname: '/interest/[id]', params: { id: interest.id } });
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete?.(interest.id);
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={styles.topRow}>
        <View style={[styles.emojiWrap, { backgroundColor: interest.color + '20' }]}>
          <Text style={styles.emoji}>{interest.emoji}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, { color: colors.foreground, flex: 1 }]}
              numberOfLines={1}
            >
              {interest.displayName}
            </Text>
            {newCount > 0 && (
              <View style={[styles.newBadge, { backgroundColor: colors.destructive ?? '#EF4444' }]}>
                <Text style={styles.newBadgeText}>
                  NEW {newCount > 99 ? '99+' : newCount}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.intentBadge, { backgroundColor: interest.color + '20' }]}>
              <Text style={[styles.intentText, { color: interest.color }]}>
                {INTENT_LABELS[interest.spec.intentType] ?? interest.spec.intentType}
              </Text>
            </View>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {interest.spec.urgency === 'high' ? '긴급' : interest.spec.urgency === 'medium' ? '보통' : '낮음'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.deleteBtn}
        >
          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.sources}>
          {interest.spec.suggestedSources.slice(0, 3).map((src) => (
            <View
              key={src}
              style={[styles.sourceBadge, { backgroundColor: colors.secondary }]}
            >
              <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>
                {SOURCE_LABELS[src] ?? src}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.alertInfo}>
          {interest.alertCount > 0 && (
            <>
              <Feather name="bell" size={11} color={colors.mutedForeground} />
              <Text style={[styles.alertCount, { color: colors.mutedForeground }]}>
                {interest.alertCount}
              </Text>
            </>
          )}
          {interest.lastAlertAt && (
            <Text style={[styles.lastAlert, { color: colors.mutedForeground }]}>
              · {formatTime(interest.lastAlertAt)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  intentText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  meta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  deleteBtn: {
    padding: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sources: {
    flexDirection: 'row',
    gap: 4,
  },
  sourceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  alertInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  lastAlert: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
