import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AlertCard from '@/components/AlertCard';
import EmptyState from '@/components/EmptyState';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Interest } from '@/types';

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { alerts, interests } = useApp();
  const { t } = useI18n();
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = React.useRef<FlatList>(null);

  const handleLogoPress = () => {
    setSelectedInterest(null);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const filteredAlerts = selectedInterest
    ? alerts.filter((a) => a.interestId === selectedInterest)
    : alerts;

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const renderHeader = () => (
    <View>
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          onPress={handleLogoPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('feed.home')}
        >
          <View style={styles.logoRow}>
            <Image
              source={require('@/assets/images/keyp-icon-mark.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t('feed.subtitle')}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/interest/add')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('interest.add.title')}
          >
            <Feather name="plus" size={22} color={colors.primaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push('/saved')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="bookmark" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        horizontal
        data={[{ id: null, displayName: t('feed.allFilter') } as unknown as Interest, ...interests]}
        keyExtractor={(item) => item.id ?? 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const isSelected = selectedInterest === item.id;
          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedInterest(item.id ?? null)}
              activeOpacity={0.8}
            >
              {item.emoji && (
                <Text style={styles.filterEmoji}>{item.emoji}</Text>
              )}
              <Text
                style={[
                  styles.filterText,
                  { color: isSelected ? '#fff' : colors.foreground },
                ]}
              >
                {item.displayName}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={filteredAlerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AlertCard alert={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="bell"
              title={t('feed.empty.title')}
              subtitle={t('feed.empty.subtitle')}
              actionLabel={t('feed.empty.action')}
              onAction={() => router.push('/interest/add')}
            />
          </View>
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomInset + 84 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  appName: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: { width: 36, height: 36, borderRadius: 9 },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  savedBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  filterList: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterEmoji: { fontSize: 13 },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  list: { paddingHorizontal: 20 },
  emptyWrap: { height: 400 },
});
