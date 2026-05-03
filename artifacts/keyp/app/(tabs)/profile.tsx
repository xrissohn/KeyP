import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
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
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
}

function MenuItem({ icon, label, onPress, danger, value }: MenuItemProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: (danger ? colors.destructive : colors.primary) + '18' }]}>
        <Feather name={icon} size={16} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value && (
        <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { interests, alerts, matches, savedAlerts, plan, annualBilling } = useApp();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const displayName = user?.displayName ?? '사용자';
  const email = user?.email ?? '';
  const initial = displayName.charAt(0).toUpperCase();
  const acceptedMatches = matches.filter((m) => m.status === 'accepted').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topInset + 8, paddingBottom: bottomInset + 84 },
        ]}
      >
        <View style={styles.profileSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
          </View>
          <Text style={[styles.displayName, { color: colors.foreground }]}>{displayName}</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{email}</Text>

          <View style={styles.statsRow}>
            {[
              { label: '관심사', value: interests.length },
              { label: '알림', value: alerts.length },
              { label: '매칭', value: acceptedMatches },
              { label: '저장', value: savedAlerts.length },
            ].map((stat) => (
              <View key={stat.label} style={[styles.statItem, { borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>활동</Text>
          <MenuItem icon="bookmark" label="저장한 알림" onPress={() => router.push('/saved')} value={`${savedAlerts.length}개`} />
          <MenuItem icon="star" label="관심사 관리" onPress={() => router.push('/(tabs)/interests')} value={`${interests.length}개`} />
          <MenuItem icon="users" label="매칭 현황" onPress={() => router.push('/(tabs)/match')} value={`${acceptedMatches}개`} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>구독</Text>
          <MenuItem
            icon="credit-card"
            label="요금제"
            onPress={() => router.push('/pricing')}
            value={`${plan.toUpperCase()}${annualBilling ? ' · 연간' : ''}`}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>설정</Text>
          <MenuItem icon="bell" label="알림 설정" onPress={() => {}} />
          <MenuItem icon="shield" label="신고/차단 목록" onPress={() => {}} />
          <MenuItem icon="lock" label="개인정보 처리방침" onPress={() => {}} />
          <MenuItem icon="file-text" label="이용약관" onPress={() => {}} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>정보</Text>
          <MenuItem icon="info" label="앱 버전" onPress={() => {}} value="1.0.0" />
          <MenuItem icon="cpu" label="AI 에이전트 상태" onPress={() => {}} value="정상" />
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.border }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>로그아웃</Text>
        </TouchableOpacity>

        <View style={[styles.agentInfo, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.agentTitle, { color: colors.primary }]}>에이전트 파이프라인</Text>
          <Text style={[styles.agentDesc, { color: colors.mutedForeground }]}>
            Planner → SourceRouter → Scout → Verifier → Delivery → Learning
          </Text>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    gap: 16,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
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
  },
  displayName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  email: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderRightWidth: 1,
    paddingVertical: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
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
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  menuValue: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginRight: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  agentInfo: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    position: 'relative',
  },
  agentTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  agentDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  statusDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
