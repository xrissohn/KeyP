import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Match, MatchMode } from '@/types';

const MODE_ICONS: Record<MatchMode, keyof typeof Feather.glyphMap> = {
  friend: 'smile',
  companion: 'map-pin',
  collaborate: 'briefcase',
  meal_mate: 'coffee',
  date: 'heart',
};

interface Props {
  match: Match;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function MatchCard({ match, onAccept, onReject }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useI18n();

  const handlePress = () => {
    router.push({ pathname: '/match/[id]', params: { id: match.id } });
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAccept?.(match.id);
  };

  const handleReject = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReject?.(match.id);
  };

  const modeIcon = MODE_ICONS[match.mode];
  const scoreColor = match.score >= 90 ? colors.success : match.score >= 75 ? colors.warning : colors.mutedForeground;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.accent + '20' }]}>
          <Text style={styles.avatarText}>
            {match.matchedUser.displayName.charAt(0)}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {match.matchedUser.displayName}
            </Text>
            <View style={[styles.modeBadge, { backgroundColor: colors.secondary }]}>
              <Feather name={modeIcon} size={10} color={colors.primary} />
              <Text style={[styles.modeText, { color: colors.primary }]}>
                {t(`match.mode.${match.mode}`)}
              </Text>
            </View>
          </View>
          {match.matchedUser.location && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.location, { color: colors.mutedForeground }]}>
                {match.matchedUser.location}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.scoreWrap}>
          <Text style={[styles.score, { color: scoreColor }]}>{match.score}</Text>
          <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>{t('match.scoreLabel')}</Text>
        </View>
      </View>

      {match.matchedUser.bio && (
        <Text style={[styles.bio, { color: colors.mutedForeground }]} numberOfLines={2}>
          {match.matchedUser.bio}
        </Text>
      )}

      <View style={styles.sharedRow}>
        <Feather name="link" size={12} color={colors.primary} />
        <Text style={[styles.sharedLabel, { color: colors.mutedForeground }]}>{t('match.shared')}</Text>
        {match.sharedInterests.map((s) => (
          <View key={s} style={[styles.sharedTag, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.sharedText, { color: colors.primary }]}>{s}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.explanation, { color: colors.mutedForeground }]} numberOfLines={2}>
        {match.explanation}
      </Text>

      {match.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.rejectBtn, { borderColor: colors.border }]}
            onPress={handleReject}
            activeOpacity={0.8}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
            <Text style={[styles.rejectText, { color: colors.mutedForeground }]}>{t('match.reject')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
            onPress={handleAccept}
            activeOpacity={0.8}
          >
            <Feather name="check" size={16} color="#fff" />
            <Text style={[styles.acceptText]}>{t('match.accept')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {match.status === 'accepted' && (
        <View style={[styles.statusBadge, { backgroundColor: colors.success + '15' }]}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>{t('match.connected')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FF6B8A' },
  userInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  displayName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  modeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  location: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  scoreWrap: { alignItems: 'center', minWidth: 40 },
  score: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  scoreLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  bio: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sharedLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  sharedTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sharedText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  explanation: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  rejectText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  acceptBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  acceptText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start' },
  statusText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
