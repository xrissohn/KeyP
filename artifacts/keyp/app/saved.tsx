import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AlertCard from '@/components/AlertCard';
import EmptyState from '@/components/EmptyState';
import UndoToast from '@/components/UndoToast';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedAlerts, upgradeSavedDummies } = useApp();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  // On mount, force-upgrade any saved alerts still pointing at placeholder
  // URLs (seeded dummies). This kicks the collector for the relevant
  // interests so the sweep-time migration in AppContext can promote a real
  // alert into the saved list. No-op when there's nothing to upgrade.
  useEffect(() => {
    upgradeSavedDummies();
  }, [upgradeSavedDummies]);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!trimmed) return savedAlerts;
    return savedAlerts.filter((a) => {
      const haystack = `${a.title} ${a.summary} ${a.interestName} ${a.tags.join(' ')}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [savedAlerts, trimmed]);

  const showSearchEmpty = trimmed.length > 0 && filtered.length === 0;

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
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {t('common.count', { n: filtered.length })}
        </Text>
      </View>

      {savedAlerts.length > 0 && (
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t('saved.searchPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
            >
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AlertCard alert={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {showSearchEmpty ? (
              <EmptyState
                icon="search"
                title={t('saved.noResults')}
                subtitle={t('saved.noResultsSub', { q: query.trim() })}
              />
            ) : (
              <EmptyState
                icon="bookmark"
                title={t('saved.empty.title')}
                subtitle={t('saved.empty.subtitle')}
              />
            )}
          </View>
        }
      />
      <UndoToast bottomOffset={bottomInset + 16} />
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
    paddingBottom: 12,
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  list: {
    paddingHorizontal: 20,
  },
  emptyWrap: { height: 400 },
});
