import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

/**
 * Trigger `onForeground` whenever the app transitions from background/inactive
 * back to active. Used to top up alerts the moment the user returns to KeyP
 * so the feed feels live without waiting for the next polling tick.
 *
 * No-op on web (no AppState lifecycle in browsers).
 */
export function useAutoRefresh(
  onForeground: () => void | Promise<void>,
  enabled: boolean = true,
): void {
  const cbRef = useRef(onForeground);
  cbRef.current = onForeground;
  const lastStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (next) => {
      const prev = lastStateRef.current;
      lastStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        try {
          const r = cbRef.current();
          if (r && typeof (r as Promise<void>).catch === 'function') {
            (r as Promise<void>).catch(() => {});
          }
        } catch {
          // swallow — refresh failure is non-critical
        }
      }
    });
    return () => sub.remove();
  }, [enabled]);
}
