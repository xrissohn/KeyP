import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { FreshnessLevel } from '@/types';

interface Props {
  confidence: number;
  freshness: FreshnessLevel;
  compact?: boolean;
}

const FRESHNESS_KEYS: Record<FreshnessLevel, string> = {
  live: 'freshness.live',
  hot: 'freshness.hot',
  recent: 'freshness.recent',
  older: 'freshness.older',
};

const FRESHNESS_COLORS: Record<FreshnessLevel, string> = {
  live: '#EF4444',
  hot: '#F97316',
  recent: '#5B7FFF',
  older: '#6B7280',
};

export default function ConfidenceBadge({ confidence, freshness, compact }: Props) {
  const colors = useColors();
  const { t } = useI18n();
  const freshnessColor = FRESHNESS_COLORS[freshness];
  const freshnessLabel = t(FRESHNESS_KEYS[freshness]);

  if (compact) {
    return (
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: freshnessColor }]} />
        <Text style={[styles.freshnessText, { color: freshnessColor }]}>
          {freshnessLabel}
        </Text>
      </View>
    );
  }

  const confidenceColor =
    confidence >= 85 ? colors.success : confidence >= 70 ? colors.warning : colors.mutedForeground;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: freshnessColor }]} />
      <Text style={[styles.freshnessText, { color: freshnessColor }]}>
        {freshnessLabel}
      </Text>
      <View style={styles.separator} />
      <Text style={[styles.confidenceText, { color: confidenceColor }]}>
        {t('confidence.label', { n: confidence })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  freshnessText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.2 },
  separator: { width: 1, height: 10, backgroundColor: '#374151', marginHorizontal: 4 },
  confidenceText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
