import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Alert } from '@/types';
import { getDeviceId } from '@/lib/deviceId';
import { callRegisterDevice } from '@/lib/agents/ApiClient';

// KeyP uses BOTH local notifications (foreground sweep results) AND remote
// Expo Push notifications (server-side poller fires while app is closed).
// On native: expo-notifications + Expo push token registered with our server.
// On web: browser Notification API only (no remote push pipeline).

let nativeModule: typeof import('expo-notifications') | null = null;
let nativeReady = false;
let nativePermissionGranted: boolean | null = null;

let webPermissionAsked = false;

async function loadNativeModule() {
  if (nativeModule || Platform.OS === 'web') return nativeModule;
  try {
    nativeModule = await import('expo-notifications');
    if (!nativeReady) {
      nativeModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      // Android requires an explicit channel or notifications won't surface
      // on many OEM builds. Safe no-op on iOS.
      if (Platform.OS === 'android') {
        try {
          await nativeModule.setNotificationChannelAsync('keyp-default', {
            name: 'KeyP 실시간 알림',
            importance: nativeModule.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
          });
        } catch (err) {
          console.warn('[KeyP] notification channel setup failed:', err);
        }
      }
      nativeReady = true;
    }
  } catch (err) {
    console.warn('[KeyP] expo-notifications module unavailable:', err);
  }
  return nativeModule;
}

async function ensureNativePermission(): Promise<boolean> {
  if (nativePermissionGranted !== null) return nativePermissionGranted;
  const mod = await loadNativeModule();
  if (!mod) {
    nativePermissionGranted = false;
    return false;
  }
  try {
    const settings = await mod.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === 3 /* provisional */) {
      nativePermissionGranted = true;
      return true;
    }
    const req = await mod.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    nativePermissionGranted = !!req.granted;
    return nativePermissionGranted;
  } catch (err) {
    console.warn('[KeyP] notification permission request failed:', err);
    nativePermissionGranted = false;
    return false;
  }
}

async function ensureWebPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  // Re-check after the previous request resolved; if still 'default', treat as denied for this session.
  if (webPermissionAsked) return false;
  webPermissionAsked = true;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

let pushTokenRegistered = false;

/**
 * Fetch this device's Expo push token (native only) and register it with
 * the server so the background poller can deliver notifications when the
 * app is closed. Idempotent per session.
 */
async function registerExpoPushTokenOnce(): Promise<void> {
  if (pushTokenRegistered || Platform.OS === 'web') return;
  const ok = await ensureNativePermission();
  if (!ok) return;
  const mod = await loadNativeModule();
  if (!mod) return;
  try {
    // Expo Go and bare workflow both need projectId for tokens; fall back to
    // device-only token (still useful for development) when unavailable.
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenResp = await mod.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp?.data;
    if (!token || typeof token !== 'string') return;
    const deviceId = await getDeviceId();
    await callRegisterDevice({
      deviceId,
      expoPushToken: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    pushTokenRegistered = true;
  } catch (err) {
    // Most common cause in Expo Go SDK 53+ is "Push notifications functionality
    // provided by expo-notifications was removed from Expo Go" — needs a dev
    // build. We swallow the error so the app keeps working.
    console.warn('[KeyP] expo push token registration skipped:', err);
  }
}

/** Initialize notification permissions early so the first alert lands fast. */
export async function initNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    await ensureWebPermission();
    return;
  }
  await ensureNativePermission();
  // Fire-and-forget: token registration shouldn't block the UI.
  void registerExpoPushTokenOnce();
}

/** Schedule a local notification for a freshly collected alert. */
export async function notifyNewAlert(alert: Alert): Promise<void> {
  const title = alert.interestName
    ? `${alert.interestName} · 새 알림`
    : '새 알림';
  const body = alert.title;

  if (Platform.OS === 'web') {
    const ok = await ensureWebPermission();
    if (!ok) return;
    try {
      const n = new Notification(title, {
        body,
        tag: alert.id,
        icon: '/favicon.ico',
      });
      // Keep a short-lived reference so the GC doesn't kill it before display.
      setTimeout(() => n.close(), 8_000);
    } catch (err) {
      console.warn('[KeyP] web notification dispatch failed:', err);
    }
    return;
  }

  const ok = await ensureNativePermission();
  if (!ok) return;
  const mod = await loadNativeModule();
  if (!mod) return;
  try {
    await mod.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { alertId: alert.id, interestId: alert.interestId },
        sound: 'default',
      },
      trigger:
        Platform.OS === 'android'
          ? { channelId: 'keyp-default' }
          : null, // iOS fires immediately
    });
  } catch (err) {
    console.warn('[KeyP] native notification dispatch failed:', err);
  }
}

/** Notify the freshest item from a batch of new alerts (avoids spam). */
export async function notifyFreshAlerts(fresh: Alert[]): Promise<void> {
  if (fresh.length === 0) return;
  const top = [...fresh].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  await notifyNewAlert(top);
}
