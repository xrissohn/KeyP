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
import { useColors } from '@/hooks/useColors';

const SLIDES = [
  {
    id: '1',
    icon: 'zap' as const,
    iconColor: '#5B7FFF',
    title: '검색이 아니라,\n당신의 관심사를\n먼저 알아채는 앱',
    subtitle:
      'KeyP는 자연어로 등록한 관심사를 AI가 구조화하고, 가장 확률 높은 소스부터 먼저 탐색합니다.',
  },
  {
    id: '2',
    icon: 'cpu' as const,
    iconColor: '#4ADE80',
    title: '멀티 에이전트가\n당신 대신 일합니다',
    subtitle:
      '플래너, 소스 라우터, 수집, 검증, 전달 에이전트가 협력해 필요한 정보만 골라 알려줍니다.',
  },
  {
    id: '3',
    icon: 'users' as const,
    iconColor: '#FF6B8A',
    title: '같은 관심사를 가진\n사람을 연결합니다',
    subtitle:
      '관심사 기반 내부 상호매칭으로 동행, 협업, 친구를 찾을 수 있습니다. 완전 opt-in 방식.',
  },
];

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);

  const isLast = activeIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[activeIndex];

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
          source={require('@/assets/images/keyp-wordmark.png')}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="KeyP"
        />

        <TouchableOpacity
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="온보딩 건너뛰기"
        >
          <Text style={[styles.skip, { color: colors.mutedForeground }]}>건너뛰기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.slide}>
        <View style={[styles.iconWrap, { backgroundColor: currentSlide.iconColor + '20' }]}>
          <Feather name={currentSlide.icon} size={56} color={currentSlide.iconColor} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{currentSlide.title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{currentSlide.subtitle}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomInset + 24 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
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
              accessibilityLabel="이전 슬라이드"
            >
              <Feather name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isLast ? '시작하기' : '다음 슬라이드'}
          >
            <Text style={styles.nextText}>{isLast ? '시작하기' : '다음'}</Text>
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
    width: 88,
    height: 28,
  },
  skip: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
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
});
