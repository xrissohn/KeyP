import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { buildSafeOpenUrl } from '@/lib/agents/ApiClient';
import { relativeTime } from '@/lib/i18n';
import type { Alert, SourceType } from '@/types';

const SOURCE_ICONS: Record<SourceType, { name: keyof typeof Feather.glyphMap; color: string }> = {
  youtube: { name: 'youtube', color: '#FF0000' },
  twitter: { name: 'twitter', color: '#1D9BF0' },
  reddit: { name: 'message-circle', color: '#FF4500' },
  rss: { name: 'rss', color: '#F97316' },
  match: { name: 'users', color: '#FF6B8A' },
};

interface Props {
  alert: Alert;
  showInterestTag?: boolean;
}

export default function AlertCard({ alert, showInterestTag = true }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { toggleSaveAlert, setAlertFeedback, hideAlert } = useApp();
  const { language, t } = useI18n();
  const sourceConfig = SOURCE_ICONS[alert.source.type];

  const handlePress = () => {
    router.push({ pathname: '/alert/[id]', params: { id: alert.id } });
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSaveAlert(alert.id);
  };

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAlertFeedback(alert.id, 'like');
  };

  const handleDislike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAlertFeedback(alert.id, 'dislike');
  };

  const handleHide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    hideAlert(alert.id);
  };

  const sourceUrl = alert.source.url ?? alert.originalUrl;
  const handleOpenSource = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    const fallbackQuery = `${alert.interestName} ${alert.title}`;
    const target = buildSafeOpenUrl(sourceUrl, fallbackQuery);
    if (!target) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(target).catch(() => {});
  };

  const formatTime = (iso: string) =>
    relativeTime(Date.now() - new Date(iso).getTime(), language);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: alert.feedback === 'dislike' || alert.feedback === 'hide' ? 0.5 : 1,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.sourceIcon,
              { backgroundColor: sourceConfig.color + '20' },
            ]}
          >
            <Feather name={sourceConfig.name} size={12} color={sourceConfig.color} />
          </View>
          <Text style={[styles.sourceName, { color: colors.mutedForeground }]}>
            {alert.source.name}
          </Text>
          {showInterestTag && (
            <>
              <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
              <Text style={[styles.interestTag, { color: colors.primary }]}>
                {alert.interestName}
              </Text>
            </>
          )}
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatTime(alert.createdAt)}
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {alert.title}
      </Text>
      <Text style={[styles.summary, { color: colors.mutedForeground }]} numberOfLines={2}>
        {alert.summary}
      </Text>

      <View style={styles.metaRow}>
        <ConfidenceBadge confidence={alert.confidence} freshness={alert.freshness} compact />
        <View style={styles.spacer} />
        <View style={styles.tags}>
          {alert.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {sourceUrl && (
        <TouchableOpacity
          style={[styles.sourceLink, { borderColor: colors.border, backgroundColor: colors.secondary }]}
          onPress={handleOpenSource}
          activeOpacity={0.7}
        >
          <Feather name="external-link" size={13} color={colors.primary} />
          <Text
            style={[styles.sourceLinkText, { color: colors.primary }]}
            numberOfLines={1}
          >
            {t('alert.openSource', { name: alert.source.name })}
          </Text>
          <Feather name="arrow-up-right" size={13} color={colors.primary} />
        </TouchableOpacity>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            alert.feedback === 'like' && { backgroundColor: colors.success + '20' },
          ]}
          onPress={handleLike}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="thumbs-up"
            size={14}
            color={alert.feedback === 'like' ? colors.success : colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            alert.feedback === 'dislike' && { backgroundColor: colors.destructive + '20' },
          ]}
          onPress={handleDislike}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="thumbs-down"
            size={14}
            color={alert.feedback === 'dislike' ? colors.destructive : colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleSave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="bookmark"
            size={14}
            color={alert.isSaved ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleHide}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="eye-off" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sourceName: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  dot: { fontSize: 12 },
  interestTag: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  time: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', lineHeight: 22, marginBottom: 6 },
  summary: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  spacer: { flex: 1 },
  tags: { flexDirection: 'row', gap: 4 },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  sourceLinkText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  actions: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10, gap: 4 },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 8 },
});
