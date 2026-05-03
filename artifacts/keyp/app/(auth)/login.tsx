import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const emailValid = email.length === 0 || isValidEmail(email);
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
    if (password.length < 4) {
      Alert.alert('비밀번호', '비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/');
    } catch {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);
    try {
      await login('demo@keyp.app', 'demo1234');
      router.replace('/(tabs)/');
    } finally {
      setIsLoading(false);
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
            <Text style={[styles.title, { color: colors.foreground }]}>다시 만나서 반가워요</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              KeyP 계정으로 로그인하세요
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>이메일</Text>
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
                  올바른 이메일 형식이 아닙니다
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.foreground }]}>비밀번호</Text>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => Alert.alert('비밀번호 찾기', '데모 앱입니다. demo@keyp.app / demo1234 로 로그인하세요.')}
                >
                  <Text style={[styles.forgotText, { color: colors.primary }]}>
                    비밀번호 찾기
                  </Text>
                </TouchableOpacity>
              </View>
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
                  placeholder="비밀번호를 입력하세요"
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
            </View>

            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => {
                Haptics.selectionAsync();
                setRememberMe(!rememberMe);
              }}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel="로그인 상태 유지"
              accessibilityState={{ checked: rememberMe }}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: rememberMe ? colors.primary : 'transparent',
                    borderColor: rememberMe ? colors.primary : colors.border,
                  },
                ]}
              >
                {rememberMe && <Feather name="check" size={12} color="#fff" />}
              </View>
              <Text style={[styles.rememberText, { color: colors.mutedForeground }]}>
                로그인 상태 유지
              </Text>
            </TouchableOpacity>

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
                  <Text style={styles.loginBtnText}>로그인</Text>
                  <Feather name="arrow-right" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>또는</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.socialRow}>
              <SocialButton
                icon="🍎"
                label="Apple"
                onPress={() => Alert.alert('준비 중', 'Apple 로그인은 곧 지원됩니다.')}
                colors={colors}
              />
              <SocialButton
                icon="G"
                label="Google"
                onPress={() => Alert.alert('준비 중', 'Google 로그인은 곧 지원됩니다.')}
                colors={colors}
              />
              <SocialButton
                icon="K"
                label="Kakao"
                onPress={() => Alert.alert('준비 중', 'Kakao 로그인은 곧 지원됩니다.')}
                colors={colors}
                bg="#FEE500"
                fg="#000"
              />
            </View>

            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '10' }]}
              onPress={handleDemoLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Feather name="play-circle" size={16} color={colors.primary} />
              <Text style={[styles.demoBtnText, { color: colors.primary }]}>
                데모 계정으로 빠르게 체험
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSwitch}>
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              아직 계정이 없으신가요?
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={[styles.switchLink, { color: colors.primary }]}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function SocialButton({
  icon,
  label,
  onPress,
  colors,
  bg,
  fg,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  bg?: string;
  fg?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.socialBtn,
        {
          backgroundColor: bg ?? colors.card,
          borderColor: bg ? bg : colors.border,
        },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.85}
    >
      <Text style={[styles.socialIcon, { color: fg ?? colors.foreground }]}>{icon}</Text>
      <Text style={[styles.socialLabel, { color: fg ?? colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    gap: 28,
    minHeight: '100%',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  header: {
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginLeft: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  socialIcon: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  socialLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  demoBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  bottomSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'auto',
  },
  switchText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  switchLink: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
