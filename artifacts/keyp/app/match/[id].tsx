import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const MODE_LABELS: Record<string, string> = {
  friend: '친구찾기',
  companion: '여행/현지 동행',
  collaborate: '협업',
  meal_mate: '밥친구',
  date: '데이트',
};

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { matches, updateMatchStatus } = useApp();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const match = matches.find((m) => m.id === id);

  if (!match) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>
          매칭을 찾을 수 없습니다
        </Text>
      </View>
    );
  }

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateMatchStatus(match.id, 'accepted');
    Alert.alert('매칭 수락', `${match.matchedUser.displayName}님과 연결되었습니다! 메시지를 보내보세요.`);
    router.back();
  };

  const handleReject = () => {
    Alert.alert('매칭 거절', '이 매칭 제안을 거절하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '거절',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          updateMatchStatus(match.id, 'rejected');
          router.back();
        },
      },
    ]);
  };

  const handleReport = () => {
    Alert.alert('신고', '신고 사유를 선택해주세요.', [
      { text: '스팸', onPress: () => {} },
      { text: '부적절한 내용', onPress: () => {} },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const scoreColor =
    match.score >= 90 ? colors.success : match.score >= 75 ? colors.warning : colors.mutedForeground;

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
        <Text style={[styles.navTitle, { color: colors.foreground }]}>매칭 상세</Text>
        <TouchableOpacity
          onPress={handleReport}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.reportBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="flag" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 100 }]}
      >
        <View style={styles.profileSection}>
          <View style={[styles.avatar, { backgroundColor: colors.accent + '20' }]}>
            <Text style={[styles.avatarText]}>
              {match.matchedUser.displayName.charAt(0)}
            </Text>
          </View>
          <Text style={[styles.displayName, { color: colors.foreground }]}>
            {match.matchedUser.displayName}
          </Text>
          {match.matchedUser.location && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.location, { color: colors.mutedForeground }]}>
                {match.matchedUser.location}
              </Text>
            </View>
          )}
          {match.matchedUser.bio && (
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>
              {match.matchedUser.bio}
            </Text>
          )}
        </View>

        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.scoreMain}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{match.score}</Text>
            <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>매칭 점수</Text>
          </View>
          <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
          <View style={styles.modeInfo}>
            <Text style={[styles.modeLabelText, { color: colors.primary }]}>
              {MODE_LABELS[match.mode] ?? match.mode}
            </Text>
            <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>매칭 목적</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            공통 관심사
          </Text>
          {match.sharedInterests.map((interest) => (
            <View key={interest} style={[styles.interestRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.interestDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.interestText, { color: colors.foreground }]}>{interest}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.reasonCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Feather name="link-2" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.reasonTitle, { color: colors.primary }]}>왜 연결됐나요?</Text>
            <Text style={[styles.reasonText, { color: colors.foreground }]}>
              {match.explanation}
            </Text>
          </View>
        </View>

        <View style={[styles.safetyCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="shield" size={14} color={colors.mutedForeground} />
          <Text style={[styles.safetyText, { color: colors.mutedForeground }]}>
            매칭 수락 전에는 정확한 위치와 연락처가 공개되지 않습니다. 모든 연결은 양측 동의 후에만 이루어집니다.
          </Text>
        </View>
      </ScrollView>

      {match.status === 'pending' && (
        <View style={[styles.actionBar, { paddingBottom: bottomInset + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.rejectBtn, { borderColor: colors.border }]}
            onPress={handleReject}
            activeOpacity={0.8}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
            <Text style={[styles.rejectText, { color: colors.mutedForeground }]}>거절</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
            onPress={handleAccept}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.acceptText}>수락하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {match.status === 'accepted' && (
        <View style={[styles.actionBar, { paddingBottom: bottomInset + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={[styles.connectedBadge, { backgroundColor: colors.success + '20' }]}>
            <Feather name="check-circle" size={18} color={colors.success} />
            <Text style={[styles.connectedText, { color: colors.success }]}>
              연결됨 — 메시지를 시작해보세요
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { textAlign: 'center', marginTop: 100, fontSize: 15 },
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
  reportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  profileSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#FF6B8A',
  },
  displayName: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 20,
  },
  scoreCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreMain: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  scoreDivider: {
    width: 1,
    height: 60,
    marginHorizontal: 20,
  },
  modeInfo: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  modeLabelText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  modeDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  interestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  interestText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  reasonCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  reasonTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  safetyCard: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
  },
  safetyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rejectText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  acceptText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  connectedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  connectedText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
