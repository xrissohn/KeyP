import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@keyp/v2/deviceId';

let cached: string | null = null;
let inflight: Promise<string> | null = null;

function generateId(): string {
  // Not security-sensitive — purely an opaque per-install identifier the
  // server uses as a key. Combine timestamp + 64 bits of randomness to keep
  // collision probability negligible without pulling in a crypto polyfill.
  const rand = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 0xffff)
        .toString(16)
        .padStart(4, '0'),
    ).join('');
  return `dev_${Date.now().toString(36)}_${rand(4)}`;
}

/**
 * Returns the persistent device id, generating + persisting one on first call.
 * Concurrent callers share the same in-flight promise to avoid two writes.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (existing) {
        cached = existing;
        return existing;
      }
      const fresh = generateId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
      cached = fresh;
      return fresh;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
