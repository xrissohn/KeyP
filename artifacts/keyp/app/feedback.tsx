import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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
import { useApp, useI18n } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { callFeedbackReport } from '@/lib/agents/ApiClient';
import { getDeviceId } from '@/lib/deviceId';

type Kind = 'feedback' | 'abuse' | 'bug' | 'other';

const KINDS: { value: Kind; key: string }[] = [
  { value: 'feedback', key: 'feedback.kind.feedback' },
  { value: 'bug', key: 'feedback.kind.bug' },
  { value: 'abuse', key: 'feedback.kind.abuse' },
  { value: 'other', key: 'feedback.kind.other' },
];

export default function FeedbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ alertId?: string; kind?: string }>();
  const { alerts } = useApp();
  const { t } = useI18n();

  const initialKind: Kind =
    params.kind === 'abuse' || params.kind === 'bug' || params.kind === 'other'
      ? params.kind
      : 'feedback';

  const [kind, setKind] = useState<Kind>(initialKind);
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const linkedAlert = params.alertId
    ? alerts.find((a) => a.id === params.alertId)
    : null;

  // RN's `Alert.alert` is a no-op on web (Expo web has no native dialog), so
  // both the validation error and the post-submit confirmation would silently
  // disappear. Fall back to `window.alert/confirm` on web and only rely on
  // the native modal on iOS/Android.
  const showAlert = (
    title: string,
    message: string,
    onConfirm?: () => void,
  ) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`${title}\n\n${message}`);
      }
      onConfirm?.();
      return;
    }
    Alert.alert(title, message, [
      { text: t('common.confirm'), onPress: onConfirm },
    ]);
  };

  const handleSubmit = async () => {
    const text = body.trim();
    if (!text) {
      showAlert(t('common.error'), t('feedback.empty'));
      return;
    }
    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const result = await callFeedbackReport({
        deviceId,
        alertId: params.alertId,
        interestId: linkedAlert?.interestId,
        kind,
        body: text,
        contact: contact.trim() || undefined,
      });
      if (!result.ok) throw new Error('submit_failed');
      showAlert(t('feedback.thanks.title'), t('feedback.thanks.body'), () =>
        router.back(),
      );
    } catch {
      showAlert(t('common.error'), t('feedback.error.body'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.navBar, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {t('feedback.title')}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t('feedback.subtitle')}
        </Text>

        {linkedAlert && (
          <View style={[styles.linkedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="link" size={14} color={colors.primary} />
            <Text style={[styles.linkedText, { color: colors.foreground }]} numberOfLines={2}>
              {linkedAlert.title}
            </Text>
          </View>
        )}

        <View style={styles.kindRow}>
          {KINDS.map((k) => {
            const active = kind === k.value;
            return (
              <TouchableOpacity
                key={k.value}
                onPress={() => setKind(k.value)}
                activeOpacity={0.85}
                style={[
                  styles.kindChip,
                  {
                    backgroundColor: active ? colors.primary + '20' : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.kindChipText,
                    { color: active ? colors.primary : colors.foreground },
                  ]}
                >
                  {t(k.key)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.body, { color: colors.foreground }]}
            placeholder={t('feedback.bodyPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TextInput
          style={[styles.contact, {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.border,
          }]}
          placeholder={t('feedback.contactPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.submitBtn, {
            backgroundColor: submitting ? colors.secondary : colors.primary,
            opacity: submitting ? 0.7 : 1,
          }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>
            {submitting ? t('feedback.submitting') : t('feedback.submit')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  scroll: { padding: 20, gap: 16 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  linkedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  linkedText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  kindChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputCard: { borderRadius: 14, borderWidth: 1, padding: 12, minHeight: 180 },
  body: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22, minHeight: 160 },
  contact: {
    fontSize: 14, fontFamily: 'Inter_400Regular',
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  submitBtn: {
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
