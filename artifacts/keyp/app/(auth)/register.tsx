import { Feather } from '@expo/vector-icons';
import { useSignUp, useSSO, useAuth as useClerkAuth } from '@clerk/expo';
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

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { isSignedIn } = useClerkAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'form' | 'verify'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const isLoading = submitting || fetchStatus === 'fetching';

  const handleSubmitEmail = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('비밀번호 오류', '비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmitting(true);
    try {
      const { error } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (error) {
        Alert.alert('회원가입 실패', error.message || '잠시 후 다시 시도해주세요.');
        return;
      }
      await signUp.verifications.sendEmailCode();
      setStage('verify');
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '잠시 후 다시 시도해주세요.';
      Alert.alert('회원가입 실패', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert('인증 코드', '이메일로 받은 인증 코드를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: () => {
            router.replace('/(tabs)');
          },
        });
      } else {
        Alert.alert('인증 실패', '코드가 올바른지 확인해주세요.');
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '인증에 실패했습니다.';
      Alert.alert('인증 실패', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      await signUp.verifications.sendEmailCode();
      Alert.alert('재전송', '인증 코드를 다시 보냈어요.');
    } catch {
      Alert.alert('재전송 실패', '잠시 후 다시 시도해주세요.');
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topInset + 32, paddingBottom: bottomInset + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/keyp-logo.png')}
              style={styles.logoMark}
              resizeMode="contain"
              accessibilityLabel="KeyP 로고"
            />
            <Text style={[styles.title, { color: colors.foreground }]}>
              {stage === 'verify' ? t('auth.verify.title') : t('auth.register.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {stage === 'verify'
                ? t('auth.verify.subtitle', { email })
                : t('auth.register.subtitle')}
            </Text>
          </View>

          {stage === 'form' ? (
            <View style={styles.form}>
              <View
                style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="mail" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t('auth.email')}
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
              {errors?.fields?.emailAddress && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errors.fields.emailAddress.message}
                </Text>
              )}

              <View
                style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
              </View>
              {errors?.fields?.password && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errors.fields.password.message}
                </Text>
              )}

              <Text style={[styles.terms, { color: colors.mutedForeground }]}>
                {t('auth.register.terms.prefix')}{' '}
                <Text style={{ color: colors.primary }}>{t('auth.register.terms.tos')}</Text>{' '}
                {t('auth.register.terms.and')}{' '}
                <Text style={{ color: colors.primary }}>{t('auth.register.terms.privacy')}</Text>
                {t('auth.register.terms.suffix')}
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleSubmitEmail}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('auth.register.btn')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>{t('auth.or')}</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity
                style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleGoogle}
                disabled={googleLoading || isLoading}
                activeOpacity={0.85}
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

              {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
              <View nativeID="clerk-captcha" />
            </View>
          ) : (
            <View style={styles.form}>
              <View
                style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="hash" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t('auth.verify.codePlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              </View>
              {errors?.fields?.code && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errors.fields.code.message}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleVerify}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('auth.verify.btn')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleResend} style={{ alignSelf: 'center' }}>
                <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                  {t('auth.verify.resend')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              {t('auth.register.haveAccount')}
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>{t('auth.register.signin')}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 32, minHeight: '100%' },
  header: { alignItems: 'center', gap: 12 },
  logoMark: { width: 72, height: 72, marginBottom: 8 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  form: { gap: 14 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  errorText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginLeft: 4 },
  terms: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
  primaryBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
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
  switchText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
