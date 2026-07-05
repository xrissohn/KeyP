import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/context/AppContext';

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.navBar, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>{t('legal.terms.title')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 32 }]}>
        <Text style={[styles.updated, { color: colors.mutedForeground }]}>{t('legal.lastUpdated')}</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>{t('legal.terms.body')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  scroll: { padding: 20, gap: 12 },
  updated: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
