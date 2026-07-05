import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import MatchCard from '@/components/MatchCard';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function MatchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { matches, updateMatchStatus } = useApp();
  const { t } = useI18n();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const pendingMatches = matches.filter((m) => m.status === 'pending');
  const acceptedMatches = matches.filter((m) => m.status === 'accepted');

  const handleAccept = (id: string) => updateMatchStatus(id, 'accepted');
  const handleReject = (id: string) => updateMatchStatus(id, 'rejected');

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: topInset + 8 }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{t('match.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {t('match.subtitle')}
      </Text>

      {pendingMatches.length > 0 && (
        <View style={[styles.sectionHeader]}>
          <View style={[styles.pendingDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t('match.newProposals', { n: pendingMatches.length })}
          </Text>
        </View>
      )}
    </View>
  );

  const allItems = [...pendingMatches, ...acceptedMatches];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item, index }) => {
          const isFirstAccepted = item.status === 'accepted' &&
            (index === 0 || allItems[index - 1].status === 'pending');
          return (
            <>
              {isFirstAccepted && (
                <View style={styles.acceptedHeader}>
                  <Text style={[styles.acceptedTitle, { color: colors.mutedForeground }]}>
                    {t('match.acceptedHeader')}
                  </Text>
                </View>
              )}
              <MatchCard match={item} onAccept={handleAccept} onReject={handleReject} />
            </>
          );
        }}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 84 }]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="users"
              title={t('match.empty.title')}
              subtitle={t('match.empty.subtitle')}
            />
          </View>
        }
      />

      <View style={[styles.infoBar, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        marginBottom: bottomInset + 84 + 8,
      }]}>
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          {t('match.info')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8, gap: 4 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  pendingDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  acceptedHeader: { paddingHorizontal: 4, paddingVertical: 8, marginTop: 8 },
  acceptedTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8 },
  list: { paddingHorizontal: 20 },
  emptyWrap: { height: 400 },
  infoBar: { position: 'absolute', bottom: 0, left: 20, right: 20, borderRadius: 12, borderWidth: 1, padding: 12 },
  infoText: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16 },
});
