import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '@/components/EmptyState';
import InterestCard from '@/components/InterestCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function InterestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { interests, deleteInterest, alerts } = useApp();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const totalAlerts = alerts.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>관심사</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {interests.length}개 등록 · {totalAlerts}개 알림
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/interest/add')}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={interests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InterestCard interest={item} onDelete={deleteInterest} />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomInset + 84 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="star"
              title="관심사가 없어요"
              subtitle="자연어로 원하는 것을 설명하면 AI가 관심사를 구조화해드립니다"
              actionLabel="첫 관심사 등록"
              onAction={() => router.push('/interest/add')}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
  },
  emptyWrap: { height: 400 },
});
