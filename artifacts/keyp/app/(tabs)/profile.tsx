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
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
  noBorder?: boolean;
}

function MenuItem({ icon, label, onPress, danger, value, noBorder }: MenuItemProps) {
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
  const { interests, alerts, matches, savedAlerts, plan, annualBilling, language, setLanguage } = useApp();
  const { t } = useI18n();
  const [langExpanded, setLangExpanded] = React.useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleLogout = () => {
    Alert.alert(t('profile.logoutConfirm.title'), t('profile.logoutConfirm.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const displayName = user?.displayName ?? t('profile.defaultUser');
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
              { label: t('profile.stat.interests'), value: interests.length },
              { label: t('profile.stat.alerts'), value: alerts.length },
              { label: t('profile.stat.matches'), value: acceptedMatches },
              { label: t('profile.stat.saved'), value: savedAlerts.length },
            ].map((stat) => (
              <View key={stat.label} style={[styles.statItem, { borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t('profile.section.activity')}</Text>
          <MenuItem icon="bookmark" label={t('profile.item.saved')} onPress={() => router.push('/saved')} value={t('common.count', { n: savedAlerts.length })} />
          <MenuItem icon="star" label={t('profile.item.interests')} onPress={() => router.push('/(tabs)/interests')} value={t('common.count', { n: interests.length })} />
          <MenuItem icon="users" label={t('profile.item.matches')} onPress={() => router.push('/(tabs)/match')} value={t('common.count', { n: acceptedMatches })} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t('profile.section.subscription')}</Text>
          <MenuItem
            icon="credit-card"
            label={t('profile.item.plan')}
            onPress={() => router.push('/pricing')}
            value={`${plan.toUpperCase()}${annualBilling ? t('profile.plan.annualSuffix') : ''}`}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t('profile.section.settings')}</Text>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => setLangExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + '18' }]}>
              <Feather name="globe" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>{t('profile.item.language')}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>
              {language === 'ko' ? t('profile.language.ko') : t('profile.language.en')}
            </Text>
            <Feather name={langExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {langExpanded && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 6 }}>
              {(['ko', 'en'] as const).map((lng) => {
                const active = language === lng;
                return (
                  <TouchableOpacity
                    key={lng}
                    onPress={() => {
                      setLanguage(lng);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: active ? colors.primary + '18' : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
                      {lng === 'ko' ? t('profile.language.ko') : t('profile.language.en')}
                    </Text>
                    {active && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <MenuItem icon="bell" label={t('profile.item.notifications')} onPress={() => {}} />
          <MenuItem icon="shield" label={t('profile.item.report')} onPress={() => {}} />
          <MenuItem icon="lock" label={t('profile.item.privacy')} onPress={() => {}} />
          <MenuItem icon="file-text" label={t('profile.item.terms')} onPress={() => {}} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t('profile.section.info')}</Text>
          <MenuItem icon="info" label={t('profile.item.appVersion')} onPress={() => {}} value="1.0.0" />
          <MenuItem icon="cpu" label={t('profile.item.agentStatus')} onPress={() => {}} value={t('profile.item.agentStatusValue')} />
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.border }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <View style={[styles.agentInfo, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.agentTitle, { color: colors.primary }]}>{t('profile.agent.title')}</Text>
          <Text style={[styles.agentDesc, { color: colors.mutedForeground }]}>
            {t('profile.agent.desc')}
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
