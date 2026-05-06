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
let webPushRegistered = false;
let cachedVapidPublicKey: string | null = null;
let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

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

// ─────────────────────────── Web Push (PWA) ───────────────────────────
//
// Browser/PWA path. The service worker at /sw.js handles `push` events
// even when every tab is closed, so we get YouTube-style background
// notifications. We hand the server a unique subscription per browser
// install and let the poller fan out alerts the same way it does for
// Expo push.

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  // Allocate a concrete ArrayBuffer (not SharedArrayBuffer-backed) so the
  // result satisfies PushManager.subscribe's BufferSource type in TS 5.9+.
  const buffer = new ArrayBuffer(rawData.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) out[i] = rawData.charCodeAt(i);
  return out;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!swRegistrationPromise) {
    swRegistrationPromise = (async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration('/');
        const reg = existing ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
        // Wait until the SW is active so subscribe() has a controller.
        if (!reg.active) await navigator.serviceWorker.ready;
        return reg;
      } catch (err) {
        console.warn('[KeyP] service worker registration failed:', err);
        return null;
      }
    })();
  }
  // Reset the cache on a null result so a transient registration failure
  // (e.g. network blip on first paint) can be retried by the next caller.
  const result = await swRegistrationPromise;
  if (!result) swRegistrationPromise = null;
  return result;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;
  // Prefer the build-time env (avoids a network round-trip on cold start).
  const fromEnv = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.length > 20) {
    cachedVapidPublicKey = fromEnv;
    return fromEnv;
  }
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return null;
    const json = (await res.json()) as { publicKey?: string };
    if (json.publicKey) {
      cachedVapidPublicKey = json.publicKey;
      return json.publicKey;
    }
  } catch (err) {
    console.warn('[KeyP] vapid key fetch failed:', err);
  }
  return null;
}

async function registerWebPushOnce(): Promise<void> {
  if (webPushRegistered || Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !('PushManager' in window)) return;
  const ok = await ensureWebPermission();
  if (!ok) return;
  const reg = await ensureServiceWorker();
  if (!reg) return;
  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const deviceId = await getDeviceId();
    const subJson = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return;
    const res = await fetch('/api/push/web-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        subscription: {
          endpoint: subJson.endpoint,
          keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
        },
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    });
    // Only mark as registered on success. A transient server error must
    // not lock us out of retrying for the rest of the session — the next
    // initNotifications() call will try again.
    if (res.ok) {
      webPushRegistered = true;
    } else {
      console.warn('[KeyP] web push subscribe rejected:', res.status);
    }
  } catch (err) {
    console.warn('[KeyP] web push subscribe failed:', err);
  }
}

/**
 * Update the PWA app icon badge to reflect unread alert count. Uses the
 * App Badging API (Chrome desktop, Android Chrome, iOS 16.4+ installed
 * PWA). No-op on browsers without support.
 */
export function setAppBadgeCount(count: number): void {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && nav.setAppBadge) {
      void nav.setAppBadge(count).catch(() => undefined);
    } else if (nav.clearAppBadge) {
      void nav.clearAppBadge().catch(() => undefined);
    }
  } catch {
    // Badging is best-effort.
  }
}

/** Initialize notification permissions early so the first alert lands fast. */
export async function initNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    await ensureWebPermission();
    // Fire-and-forget so the UI never waits on the SW registration.
    void registerWebPushOnce();
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
        icon: '/icon-192.png',
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
