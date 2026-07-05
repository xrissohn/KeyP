import { Feather } from '@expo/vector-icons';
import { useSignIn, useSSO, useAuth as useClerkAuth } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/context/AppContext';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { isSignedIn } = useClerkAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  useEffect(() => {
    if (isSignedIn) router.replace('/(tabs)');
  }, [isSignedIn, router]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const emailValid = email.length === 0 || isValidEmail(email);
  const isLoading = submitting || fetchStatus === 'fetching';
  const canSubmit =
    email.trim().length > 0 && isValidEmail(email) && password.length >= 4 && !isLoading;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('이메일 형식', '올바른 이메일 주소를 입력해주세요.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const { error } = await signIn.password({
        emailAddress: email.trim(),
        password,
      });
      if (error) {
        Alert.alert(
          '로그인 실패',
          error.message || '이메일 또는 비밀번호를 확인해주세요.',
        );
        return;
      }
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: () => {
            router.replace('/(tabs)');
          },
        });
      } else {
        Alert.alert('로그인 실패', '추가 인증 단계가 필요합니다.');
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '잠시 후 다시 시도해주세요.';
      Alert.alert('로그인 실패', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    Haptics.selectionAsync();
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'keyp' }),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async () => {
            router.replace('/(tabs)');
          },
        });
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? 'Google 로그인에 실패했습니다.';
      Alert.alert('Google 로그인 실패', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/onboarding');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topInset + 8, paddingBottom: bottomInset + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Image
              source={require('@/assets/images/keyp-logo.png')}
              style={styles.logoMark}
              resizeMode="contain"
              accessibilityLabel="KeyP 로고"
            />
            <Text style={[styles.title, { color: colors.foreground }]}>{t('auth.login.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t('auth.login.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t('auth.email')}</Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: colors.card,
                    borderColor: !emailValid
                      ? colors.destructive
                      : emailFocused
                      ? colors.primary
                      : colors.border,
                    borderWidth: emailFocused || !emailValid ? 1.5 : 1,
                  },
                ]}
              >
                <Feather
                  name="mail"
                  size={18}
                  color={emailFocused ? colors.primary : colors.mutedForeground}
                />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                />
                {email.length > 0 && isValidEmail(email) && (
                  <Feather name="check-circle" size={16} color={colors.success} />
                )}
              </View>
              {!emailValid && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {t('auth.invalidEmail')}
                </Text>
              )}
              {errors?.fields?.identifier && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errors.fields.identifier.message}
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t('auth.password')}</Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: colors.card,
                    borderColor: passwordFocused ? colors.primary : colors.border,
                    borderWidth: passwordFocused ? 1.5 : 1,
                  },
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color={passwordFocused ? colors.primary : colors.mutedForeground}
                />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  accessibilityState={{ expanded: showPassword }}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
              {errors?.fields?.password && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errors.fields.password.message}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.loginBtn,
                {
                  backgroundColor: canSubmit ? colors.primary : colors.muted,
                  opacity: canSubmit ? 1 : 0.6,
                },
              ]}
              onPress={handleLogin}
              disabled={!canSubmit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="로그인"
              accessibilityState={{ disabled: !canSubmit, busy: isLoading }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>{t('auth.login.btn')}</Text>
                  <Feather name="arrow-right" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>{t('auth.or')}</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <TouchableOpacity
              style={[
                styles.googleBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={handleGoogle}
              disabled={googleLoading || isLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Google로 로그인"
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <>
                  <Text style={[styles.googleIcon, { color: colors.foreground }]}>G</Text>
                  <Text style={[styles.googleLabel, { color: colors.foreground }]}>
                    {t('auth.google.continue')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSwitch}>
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              {t('auth.noAccount')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={[styles.switchLink, { color: colors.primary }]}>{t('auth.signup')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 28, minHeight: '100%' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  header: { alignItems: 'center', gap: 10 },
  logoMark: { width: 72, height: 72, marginBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  form: { gap: 16 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  errorText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginLeft: 4 },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  loginBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleIcon: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  googleLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bottomSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'auto',
  },
  switchText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  switchLink: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
