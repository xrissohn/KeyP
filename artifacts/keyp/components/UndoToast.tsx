import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface Props {
  bottomOffset?: number;
}

export default function UndoToast({ bottomOffset = 16 }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recentlyHidden, restoreHidden, dismissHidden } = useApp();
  const { t } = useI18n();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    if (recentlyHidden) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [recentlyHidden, opacity, translateY]);

  if (!recentlyHidden) return null;

  const safeBottom = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { bottom: safeBottom + bottomOffset, opacity, transform: [{ translateY }] },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.foreground,
            shadowColor: '#000',
          },
        ]}
      >
        <Feather name="eye-off" size={16} color={colors.background} />
        <Text style={[styles.message, { color: colors.background }]} numberOfLines={1}>
          {t('alert.hidden.toast')}
        </Text>
        <TouchableOpacity
          onPress={restoreHidden}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('alert.undo')}
        >
          <Text style={[styles.action, { color: colors.primary }]}>{t('alert.undo')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={dismissHidden}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
        >
          <Feather name="x" size={16} color={colors.background} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 280,
    maxWidth: 480,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  action: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 4,
  },
});
