import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { callTrendingInterests, type TrendingInterestItem } from '@/lib/agents/ApiClient';

const SLIDE_META = [
  { id: '1', icon: 'zap' as const, iconColor: '#5B7FFF', titleKey: 'onboarding.slide1.title', subtitleKey: 'onboarding.slide1.subtitle' },
  { id: '2', icon: 'cpu' as const, iconColor: '#4ADE80', titleKey: 'onboarding.slide2.title', subtitleKey: 'onboarding.slide2.subtitle' },
  { id: '3', icon: 'users' as const, iconColor: '#FF6B8A', titleKey: 'onboarding.slide3.title', subtitleKey: 'onboarding.slide3.subtitle' },
];

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const { language, setLanguage } = useApp();
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [trending, setTrending] = useState<TrendingInterestItem[]>([]);

  React.useEffect(() => {
    let alive = true;
    callTrendingInterests().then((items) => {
      if (alive) setTrending(items);
    });
    return () => { alive = false; };
  }, []);

  const isLast = activeIndex === SLIDE_META.length - 1;
  const isFirst = activeIndex === 0;
  const currentSlide = SLIDE_META[activeIndex];

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      await completeOnboarding();
      router.replace('/(auth)/login');
    } else {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleBack = () => {
    if (activeIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace('/(auth)/login');
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topInset + 12 }]}>
        <Image
          source={require('@/assets/images/keyp-icon-mark.png')}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="KeyP"
        />

        <TouchableOpacity
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skipA11y')}
        >
          <Text style={[styles.skip, { color: colors.mutedForeground }]}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      {isFirst && (
        <View style={styles.langPicker}>
          <Text style={[styles.langTitle, { color: colors.foreground }]}>{t('onboarding.lang.title')}</Text>
          <Text style={[styles.langSubtitle, { color: colors.mutedForeground }]}>{t('onboarding.lang.subtitle')}</Text>
          <View style={styles.langRow}>
            {(['ko', 'en'] as const).map((lng) => {
              const active = language === lng;
              return (
                <TouchableOpacity
                  key={lng}
                  onPress={() => {
                    setLanguage(lng);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.langBtn,
                    {
                      backgroundColor: active ? colors.primary + '20' : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.langBtnText, { color: colors.foreground }]}>
                    {lng === 'ko' ? '한국어' : 'English'}
                  </Text>
                  {active && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.slide}>
        <View style={[styles.iconWrap, { backgroundColor: currentSlide.iconColor + '20' }]}>
          <Feather name={currentSlide.icon} size={56} color={currentSlide.iconColor} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{t(currentSlide.titleKey)}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t(currentSlide.subtitleKey)}</Text>
        {activeIndex === 0 && (
          <Text style={[styles.notNews, { color: colors.mutedForeground }]}>
            {t('onboarding.notNews.subtitle')}
          </Text>
        )}
        {activeIndex === SLIDE_META.length - 1 && trending.length > 0 && (
          <View style={styles.trendingWrap}>
            <Text style={[styles.trendingTitle, { color: colors.mutedForeground }]}>
              {t('onboarding.trending.title')}
            </Text>
            <View style={styles.trendingRow}>
              {trending.slice(0, 8).map((item) => (
                <View key={item.label} style={[styles.trendingChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.trendingText, { color: colors.primary }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: bottomInset + 24 }]}>
        <View style={styles.dots}>
          {SLIDE_META.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? colors.primary : colors.border,
                  width: i === activeIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.btnRow}>
          {activeIndex > 0 && (
            <TouchableOpacity
              style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handleBack}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.prev')}
            >
              <Feather name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t('onboarding.start') : t('onboarding.next')}
          >
            <Text style={styles.nextText}>{isLast ? t('onboarding.start') : t('onboarding.next')}</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  wordmark: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  skip: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  langPicker: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  langTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  langSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  langBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 24,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 23,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backBtn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  nextText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  notNews: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    paddingHorizontal: 8,
    opacity: 0.85,
  },
  trendingWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  trendingTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  trendingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  trendingChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 200,
  },
  trendingText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
