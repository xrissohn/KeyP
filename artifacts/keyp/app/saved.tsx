import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AlertCard from '@/components/AlertCard';
import EmptyState from '@/components/EmptyState';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedAlerts, upgradeSavedDummies } = useApp();
  const { t } = useI18n();

  // On mount, force-upgrade any saved alerts still pointing at placeholder
  // URLs (seeded dummies). This kicks the collector for the relevant
  // interests so the sweep-time migration in AppContext can promote a real
  // alert into the saved list. No-op when there's nothing to upgrade.
  useEffect(() => {
    upgradeSavedDummies();
  }, [upgradeSavedDummies]);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>{t('saved.title')}</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{t('common.count', { n: savedAlerts.length })}</Text>
      </View>

      <FlatList
        data={savedAlerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AlertCard alert={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="bookmark"
              title={t('saved.empty.title')}
              subtitle={t('saved.empty.subtitle')}
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
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  count: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  list: {
    paddingHorizontal: 20,
  },
  emptyWrap: { height: 400 },
});
