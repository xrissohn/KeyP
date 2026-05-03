import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/AppContext';
import {
  callAdminMe,
  callAdminStats,
  callAdminVerifierStats,
  type AdminMe,
  type AdminStats,
  type AdminVerifierStats,
} from '@/lib/agents/ApiClient';

interface StatTileProps {
  label: string;
  value: string | number;
}

function StatTile({ label, value }: StatTileProps) {
  const colors = useColors();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const colors = useColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={{ padding: 12, gap: 8 }}>{children}</View>
    </View>
  );
}

interface HostRowProps {
  host: string;
  primary: string;
  secondary?: string;
}

function HostRow({ host, primary, secondary }: HostRowProps) {
  const colors = useColors();
  return (
    <View style={[styles.hostRow, { borderColor: colors.border }]}>
      <Text numberOfLines={1} style={[styles.hostText, { color: colors.foreground }]}>
        {host}
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.hostPrimary, { color: colors.foreground }]}>{primary}</Text>
        {secondary ? (
          <Text style={[styles.hostSecondary, { color: colors.mutedForeground }]}>{secondary}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const { t } = useI18n();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [me, setMe] = useState<AdminMe | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [verifier, setVerifier] = useState<AdminVerifierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [meRes, statsRes, verifierRes] = await Promise.all([
        callAdminMe(),
        callAdminStats(),
        callAdminVerifierStats(),
      ]);
      setMe(meRes);
      setStats(statsRes);
      setVerifier(verifierRes);
      if (!statsRes && !verifierRes && !meRes.isAdmin) {
        setError(t('admin.notAuthorized.body'));
      }
    } catch {
      setError(t('admin.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // Client-side gate (server is the source of truth, so this is only a UX
  // shortcut; the API endpoints themselves still 404 for non-admins).
  if (!isAdmin) {
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
          <Text style={[styles.navTitle, { color: colors.foreground }]}>{t('admin.title')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <Feather name="lock" size={32} color={colors.mutedForeground} />
          <Text style={[styles.notAuthorizedTitle, { color: colors.foreground }]}>
            {t('admin.notAuthorized.title')}
          </Text>
          <Text style={[styles.notAuthorizedBody, { color: colors.mutedForeground }]}>
            {t('admin.notAuthorized.body')}
          </Text>
        </View>
      </View>
    );
  }

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
        <Text style={[styles.navTitle, { color: colors.foreground }]}>{t('admin.title')}</Text>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t('admin.subtitle')}
        </Text>

        <View style={[styles.identityCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]}>
          <Feather name="shield" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.identityTitle, { color: colors.primary }]}>{t('admin.you')}</Text>
            <Text style={[styles.identityEmail, { color: colors.foreground }]}>
              {me?.email ?? user?.email ?? ''}
            </Text>
            <Text style={[styles.identityNote, { color: colors.mutedForeground }]}>
              {t('admin.unlimitedNote')}
            </Text>
          </View>
        </View>

        {loading && !stats && !verifier ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
            <Text style={{ color: colors.destructive }}>{error}</Text>
          </View>
        ) : null}

        {stats ? (
          <Section title={t('admin.section.system')}>
            <View style={styles.statRow}>
              <StatTile label={t('admin.stat.devices')} value={stats.pushDevices} />
              <StatTile label={t('admin.stat.interests')} value={stats.trackedInterests} />
            </View>
            <View style={styles.statRow}>
              <StatTile label={t('admin.stat.alerts')} value={stats.seenAlerts} />
              <StatTile label={t('admin.stat.blacklist')} value={stats.blacklist.size} />
            </View>
          </Section>
        ) : null}

        {verifier ? (
          <Section title={t('admin.section.verifier')}>
            <View style={styles.statRow}>
              <StatTile
                label={t('admin.stat.passRate')}
                value={`${Math.round(verifier.overall.passRate * 100)}%`}
              />
              <StatTile
                label={t('admin.stat.avgConfidence')}
                value={verifier.overall.avgConfidence.toFixed(1)}
              />
            </View>
            <View style={styles.statRow}>
              <StatTile label={t('admin.stat.totalChecked')} value={verifier.overall.totalChecked} />
              <StatTile label={t('admin.stat.blacklist')} value={verifier.deadUrl.blacklistSize} />
            </View>
          </Section>
        ) : null}

        {verifier && verifier.topPassHosts.length > 0 ? (
          <Section title={t('admin.section.topHosts')}>
            {verifier.topPassHosts.slice(0, 8).map((h) => (
              <HostRow
                key={`pass-${h.host}`}
                host={h.host}
                primary={`${h.passes} pass`}
                secondary={`${Math.round(h.passRate * 100)}% • ${h.avgConfidence.toFixed(1)}`}
              />
            ))}
          </Section>
        ) : null}

        {verifier && verifier.topRejectHosts.length > 0 ? (
          <Section title={t('admin.section.rejectHosts')}>
            {verifier.topRejectHosts.slice(0, 8).map((h) => (
              <HostRow
                key={`rej-${h.host}`}
                host={h.host}
                primary={`${h.rejects} reject`}
                secondary={`${Math.round(h.passRate * 100)}% pass`}
              />
            ))}
          </Section>
        ) : null}

        {verifier && verifier.deadUrl.recentDeadHosts.length > 0 ? (
          <Section title={t('admin.section.deadHosts')}>
            {verifier.deadUrl.recentDeadHosts.slice(0, 8).map((h) => (
              <HostRow key={`dead-${h.host}`} host={h.host} primary={String(h.count)} />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: 16, gap: 14 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  identityCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  identityTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  identityEmail: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  identityNote: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 17 },
  section: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  statRow: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
    gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  hostText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  hostPrimary: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hostSecondary: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  notAuthorizedTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  notAuthorizedBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
