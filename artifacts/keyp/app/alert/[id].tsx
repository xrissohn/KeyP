import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { buildSafeOpenUrl } from '@/lib/agents/ApiClient';
import type { SourceType } from '@/types';

const SOURCE_COLORS: Record<SourceType, string> = {
  youtube: '#FF0000',
  twitter: '#1D9BF0',
  reddit: '#FF4500',
  rss: '#F97316',
  match: '#FF6B8A',
};

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { alerts, toggleSaveAlert, setAlertFeedback, hideAlert, markAlertRead } = useApp();
  const { language, t } = useI18n();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const alert = alerts.find((a) => a.id === id);

  React.useEffect(() => {
    if (alert && !alert.readAt) markAlertRead(alert.id);
  }, [alert, markAlertRead]);

  if (!alert) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>
          {t('alert.notFound')}
        </Text>
      </View>
    );
  }

  const sourceColor = SOURCE_COLORS[alert.source.type];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    try {
      const locale = language === 'ko' ? 'ko-KR' : 'en-US';
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString();
    }
  };

  const handleShare = async () => {
    if (!alert) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = alert.originalUrl ?? alert.source.url ?? '';
    const message = t('alert.shareMessage', { title: alert.title, url });
    try {
      const result = await Share.share({ message, title: alert.title, url });
      if (result.action === Share.dismissedAction) return;
    } catch {
      // Native share unavailable (e.g. web) — fall back to opening the source
      if (url) {
        const target = buildSafeOpenUrl(url, `${alert.interestName} ${alert.title}`);
        if (target) Linking.openURL(target).catch(() => {});
      }
    }
  };

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
        <View style={styles.navActions}>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.saveBtn, { backgroundColor: colors.secondary }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('alert.share')}
          >
            <Feather name="share-2" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleSaveAlert(alert.id);
            }}
            style={[styles.saveBtn, { backgroundColor: colors.secondary }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name="bookmark"
              size={18}
              color={alert.isSaved ? colors.primary : colors.foreground}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 24 }]}
      >
        <View style={styles.topSection}>
          <View style={styles.metaRow}>
            <View style={[styles.sourceChip, { backgroundColor: sourceColor + '20' }]}>
              <Text style={[styles.sourceName, { color: sourceColor }]}>
                {alert.source.name}
              </Text>
            </View>
            <Text style={[styles.interestTag, { color: colors.primary }]}>
              {alert.interestName}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>{alert.title}</Text>

          <View style={styles.badgeRow}>
            <ConfidenceBadge confidence={alert.confidence} freshness={alert.freshness} />
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {formatDate(alert.createdAt)}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t('alert.summary')}</Text>
          <Text style={[styles.summary, { color: colors.foreground }]}>{alert.summary}</Text>
        </View>

        <View style={[styles.reasonCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Feather name="info" size={14} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>{t('alert.why')}</Text>
            <Text style={[styles.reason, { color: colors.foreground }]}>{alert.reason}</Text>
          </View>
        </View>

        {alert.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t('alert.relatedTags')}</Text>
            <View style={styles.tags}>
              {alert.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {alert.originalUrl && (
          <TouchableOpacity
            style={[styles.sourceLink, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              const target = buildSafeOpenUrl(
                alert.originalUrl,
                `${alert.interestName} ${alert.title}`,
              );
              if (target) Linking.openURL(target).catch(() => {});
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.sourceLinkIcon, { backgroundColor: sourceColor + '20' }]}>
              <Feather name="external-link" size={16} color={sourceColor} />
            </View>
            <Text style={[styles.sourceLinkText, { color: colors.foreground }]}>
              {t('alert.openOriginal', { name: alert.source.name })}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        <View style={[styles.feedbackSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {t('alert.feedback.helpful')}
          </Text>
          <View style={styles.feedbackBtns}>
            {([
              { type: 'like' as const, icon: 'thumbs-up' as const, label: t('alert.feedback.like'), color: colors.success },
              { type: 'dislike' as const, icon: 'thumbs-down' as const, label: t('alert.feedback.dislike'), color: colors.destructive },
              { type: 'more' as const, icon: 'plus-circle' as const, label: t('alert.feedback.more'), color: colors.primary },
              { type: 'hide' as const, icon: 'eye-off' as const, label: t('alert.feedback.hide'), color: colors.mutedForeground },
            ] as const).map(({ type, icon, label, color }) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.feedbackBtn,
                  {
                    backgroundColor: alert.feedback === type ? color + '20' : colors.secondary,
                    borderColor: alert.feedback === type ? color : 'transparent',
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (type === 'hide') {
                    hideAlert(alert.id);
                    router.back();
                  } else {
                    setAlertFeedback(alert.id, type);
                  }
                }}
                activeOpacity={0.8}
              >
                <Feather name={icon} size={16} color={alert.feedback === type ? color : colors.mutedForeground} />
                <Text style={[styles.feedbackLabel, { color: alert.feedback === type ? color : colors.mutedForeground }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { textAlign: 'center', marginTop: 100, fontSize: 15 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  topSection: { gap: 12 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceName: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  interestTag: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    lineHeight: 30,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  reasonCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 23,
  },
  reason: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginTop: 4,
  },
  tagsSection: { gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  sourceLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceLinkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  feedbackSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  feedbackBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
