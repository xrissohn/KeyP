import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MOCK_ALERTS, MOCK_INTERESTS, MOCK_MATCHES } from '@/data/mockData';
import { generateAlertsForSpec } from '@/lib/agents/MockPipeline';
import { parseInterest } from '@/lib/agents/PlannerAgent';
import type { AgentStep } from '@workspace/api-client-react';
import type { Alert, FeedbackType, Interest, InterestSpec, Match } from '@/types';

export interface AddInterestResult {
  spec: InterestSpec;
  steps: AgentStep[];
}

export interface RefreshResult {
  interestId: string;
  newAlertCount: number;
  totalCollected: number;
}

interface AppContextType {
  interests: Interest[];
  alerts: Alert[];
  matches: Match[];
  isProcessingInterest: boolean;
  addInterest: (
    userId: string,
    rawText: string,
    onSteps?: (steps: AgentStep[]) => void
  ) => Promise<AddInterestResult>;
  deleteInterest: (interestId: string) => void;
  toggleSaveAlert: (alertId: string) => void;
  setAlertFeedback: (alertId: string, feedback: FeedbackType) => void;
  hideAlert: (alertId: string) => void;
  updateMatchStatus: (matchId: string, status: Match['status']) => void;
  markInterestViewed: (interestId: string) => void;
  getNewAlertCount: (interestId: string) => number;
  savedAlerts: Alert[];
  unreadCount: number;
  // ─── Realtime collection ───────────────────────────────
  /** Manually re-run the collector for one interest. Returns # of new alerts found. */
  refreshInterest: (interestId: string) => Promise<RefreshResult>;
  /** Re-run the collector for every active interest, sequentially. */
  refreshAllInterests: () => Promise<RefreshResult[]>;
  /** Set of interestIds currently being refreshed. */
  refreshingInterestIds: string[];
  /** ISO timestamp of the last automatic background collection cycle. */
  lastBackgroundRunAt: string | null;
  /** Whether the background collector is enabled. */
  autoCollectEnabled: boolean;
  setAutoCollectEnabled: (v: boolean) => void;
  /** Polling interval (ms) for the background collector. */
  autoCollectIntervalMs: number;
  setAutoCollectIntervalMs: (ms: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  INTERESTS: '@keyp/interests',
  ALERTS: '@keyp/alerts',
  MATCHES: '@keyp/matches',
  AUTO_COLLECT: '@keyp/autoCollect',
};

// Real-time defaults: every 2 minutes the background collector sweeps every
// active interest and only adds genuinely new alerts (deduped by URL/title).
const DEFAULT_AUTO_COLLECT_INTERVAL_MS = 2 * 60 * 1000;
// Per-interest cooldown so manual + automatic refreshes don't double-fire.
const REFRESH_COOLDOWN_MS = 60 * 1000;
// How many alerts to ask the collector for per refresh sweep.
const REFRESH_BATCH_SIZE = 5;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [interests, setInterests] = useState<Interest[]>(MOCK_INTERESTS);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);
  const [isProcessingInterest, setIsProcessingInterest] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [refreshingInterestIds, setRefreshingInterestIds] = useState<string[]>([]);
  const [lastBackgroundRunAt, setLastBackgroundRunAt] = useState<string | null>(null);
  const [autoCollectEnabled, setAutoCollectEnabled] = useState<boolean>(true);
  const [autoCollectIntervalMs, setAutoCollectIntervalMs] = useState<number>(
    DEFAULT_AUTO_COLLECT_INTERVAL_MS
  );

  // Refs needed inside the polling timer so the interval doesn't capture stale state.
  const interestsRef = useRef(interests);
  const alertsRef = useRef(alerts);
  const sweepRunningRef = useRef(false);
  // Synchronous per-interest in-flight lock. We need this *in addition* to the
  // `refreshingInterestIds` React state because state updates are async — two
  // back-to-back `refreshInterest(id)` calls would both observe the same empty
  // state and both kick off real fetches, defeating the dedup. The Set is
  // mutated synchronously, so the second call hits a hard "busy" check.
  const inFlightInterestsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    interestsRef.current = interests;
  }, [interests]);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Single-writer persistence: each state slice persists whenever it changes
  // post-hydration. This eliminates the lost-update race that came from many
  // call sites each writing their own snapshot to AsyncStorage out of order.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.INTERESTS, JSON.stringify(interests)).catch(
      () => {}
    );
  }, [interests, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts)).catch(() => {});
  }, [alerts, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches)).catch(
      () => {}
    );
  }, [matches, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEYS.AUTO_COLLECT,
      JSON.stringify({ enabled: autoCollectEnabled, intervalMs: autoCollectIntervalMs })
    ).catch(() => {});
  }, [autoCollectEnabled, autoCollectIntervalMs, hydrated]);

  // Normalize persisted data so that Interest.id === Interest.spec.id, and
  // remap any Alert.interestId that referenced the old interest id to the new
  // (spec.id-aligned) one. This fixes legacy data where the two ids drifted.
  const normalize = (rawInterests: Interest[], rawAlerts: Alert[]) => {
    const idMap = new Map<string, string>();
    const fixedInterests = rawInterests.map((i) => {
      const target = i.spec?.id ?? i.id;
      if (i.id !== target) idMap.set(i.id, target);
      return { ...i, id: target };
    });
    const fixedAlerts =
      idMap.size === 0
        ? rawAlerts
        : rawAlerts.map((a) =>
            idMap.has(a.interestId)
              ? { ...a, interestId: idMap.get(a.interestId)! }
              : a
          );
    return { interests: fixedInterests, alerts: fixedAlerts };
  };

  const loadFromStorage = async () => {
    try {
      const [iStr, aStr, mStr, autoStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INTERESTS),
        AsyncStorage.getItem(STORAGE_KEYS.ALERTS),
        AsyncStorage.getItem(STORAGE_KEYS.MATCHES),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_COLLECT),
      ]);
      const rawInterests: Interest[] = iStr ? JSON.parse(iStr) : MOCK_INTERESTS;
      const rawAlerts: Alert[] = aStr ? JSON.parse(aStr) : MOCK_ALERTS;
      const { interests: nInterests, alerts: nAlerts } = normalize(
        rawInterests,
        rawAlerts
      );
      setInterests(nInterests);
      setAlerts(nAlerts);
      if (mStr) setMatches(JSON.parse(mStr));
      if (autoStr) {
        try {
          const cfg = JSON.parse(autoStr) as { enabled?: boolean; intervalMs?: number };
          if (typeof cfg.enabled === 'boolean') setAutoCollectEnabled(cfg.enabled);
          if (typeof cfg.intervalMs === 'number' && cfg.intervalMs >= 30_000) {
            setAutoCollectIntervalMs(cfg.intervalMs);
          }
        } catch {}
      }
    } catch {
      // use mock defaults already in initial state
    } finally {
      setHydrated(true);
    }
  };

  const addInterest = useCallback(
    async (
      userId: string,
      rawText: string,
      onSteps?: (steps: AgentStep[]) => void
    ): Promise<AddInterestResult> => {
      setIsProcessingInterest(true);
      try {
        const { spec, steps: plannerSteps } = await parseInterest(userId, rawText);
        onSteps?.(plannerSteps);

        const INTEREST_COLORS = ['#5B7FFF', '#FF6B8A', '#4ADE80', '#FBBF24', '#A78BFA', '#34D399'];
        const EMOJIS = ['⭐', '🎯', '🔥', '✨', '🚀', '💡', '🎵', '🌟'];

        const newInterest: Interest = {
          id: spec.id,
          displayName: spec.topic,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          color: INTEREST_COLORS[Math.floor(Math.random() * INTEREST_COLORS.length)],
          spec,
          alertCount: 0,
          lastAlertAt: undefined,
          lastRefreshedAt: undefined,
        };
        if (newInterest.id !== newInterest.spec.id) {
          console.warn(
            '[KeyP] invariant violated: Interest.id !== Interest.spec.id',
            { interestId: newInterest.id, specId: newInterest.spec.id }
          );
        }

        setInterests((prev) => [newInterest, ...prev]);

        const { alerts: newAlerts, steps: collectorSteps } = await generateAlertsForSpec(spec, 3);
        onSteps?.([...plannerSteps, ...collectorSteps]);

        const nowIso = new Date().toISOString();
        setAlerts((prev) => [...newAlerts, ...prev]);
        setInterests((prev) =>
          prev.map((i) =>
            i.id === newInterest.id
              ? {
                  ...i,
                  alertCount: newAlerts.length,
                  lastAlertAt: nowIso,
                  lastRefreshedAt: nowIso,
                }
              : i
          )
        );

        return { spec, steps: [...plannerSteps, ...collectorSteps] };
      } finally {
        setIsProcessingInterest(false);
      }
    },
    []
  );

  const deleteInterest = useCallback((interestId: string) => {
    setInterests((prev) => prev.filter((i) => i.id !== interestId));
  }, []);

  const toggleSaveAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isSaved: !a.isSaved } : a))
    );
  }, []);

  const setAlertFeedback = useCallback((alertId: string, feedback: FeedbackType) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, feedback } : a))
    );
  }, []);

  const hideAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const updateMatchStatus = useCallback((matchId: string, status: Match['status']) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, status } : m))
    );
  }, []);

  const markInterestViewed = useCallback((interestId: string) => {
    const now = new Date().toISOString();
    setInterests((prev) =>
      prev.map((i) => (i.id === interestId ? { ...i, lastViewedAt: now } : i))
    );
  }, []);

  const getNewAlertCount = useCallback(
    (interestId: string) => {
      const interest = interests.find((i) => i.id === interestId);
      const cutoff = interest?.lastViewedAt
        ? new Date(interest.lastViewedAt).getTime()
        : 0;
      return alerts.filter(
        (a) => a.interestId === interestId && new Date(a.createdAt).getTime() > cutoff
      ).length;
    },
    [interests, alerts]
  );

  // ─── Real-time collection ────────────────────────────────────────────
  // refreshInterest: re-run the collector for one interest, dedupe newly
  // collected alerts against what we already have for that interest, and
  // append only the genuinely new ones. Returns how many were new.
  const refreshInterest = useCallback(
    async (interestId: string): Promise<RefreshResult> => {
      // 1) SYNCHRONOUS in-flight lock — must run before any await so two back-
      //    to-back callers don't both pass the duplicate check.
      if (inFlightInterestsRef.current.has(interestId)) {
        return { interestId, newAlertCount: 0, totalCollected: 0 };
      }
      const interest = interestsRef.current.find((i) => i.id === interestId);
      if (!interest) {
        return { interestId, newAlertCount: 0, totalCollected: 0 };
      }
      // Cooldown: skip if we just refreshed.
      if (
        interest.lastRefreshedAt &&
        Date.now() - new Date(interest.lastRefreshedAt).getTime() < REFRESH_COOLDOWN_MS
      ) {
        return { interestId, newAlertCount: 0, totalCollected: 0 };
      }

      inFlightInterestsRef.current.add(interestId);
      setRefreshingInterestIds((prev) =>
        prev.includes(interestId) ? prev : [...prev, interestId]
      );
      try {
        const { alerts: incoming } = await generateAlertsForSpec(
          interest.spec,
          REFRESH_BATCH_SIZE
        );

        // Dedupe: an alert is "already known" if its URL matches an existing
        // alert for this interest OR if its normalized title matches. We check
        // BOTH unconditionally so that same-title/different-URL duplicates are
        // also rejected.
        const existing = alertsRef.current.filter((a) => a.interestId === interestId);
        const seenUrls = new Set<string>();
        const seenTitles = new Set<string>();
        const normTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
        existing.forEach((a) => {
          const url = a.source?.url ?? a.originalUrl;
          if (url) seenUrls.add(url);
          seenTitles.add(normTitle(a.title));
        });

        const fresh: Alert[] = [];
        for (const a of incoming) {
          const url = a.source?.url ?? a.originalUrl;
          const titleKey = normTitle(a.title);
          if (url && seenUrls.has(url)) continue;
          if (seenTitles.has(titleKey)) continue;
          // Stamp fresh alerts with "now" so they show as live and are picked
          // up by the NEW badge (createdAt > lastViewedAt).
          fresh.push({ ...a, createdAt: new Date().toISOString(), freshness: 'live' });
          if (url) seenUrls.add(url);
          seenTitles.add(titleKey);
        }

        const nowIso = new Date().toISOString();
        if (fresh.length > 0) {
          setAlerts((prev) => [...fresh, ...prev]);
        }
        setInterests((prev) =>
          prev.map((i) =>
            i.id === interestId
              ? {
                  ...i,
                  alertCount: i.alertCount + fresh.length,
                  lastAlertAt: fresh.length > 0 ? nowIso : i.lastAlertAt,
                  lastRefreshedAt: nowIso,
                }
              : i
          )
        );

        return {
          interestId,
          newAlertCount: fresh.length,
          totalCollected: incoming.length,
        };
      } catch (err) {
        console.warn('[KeyP] refreshInterest failed', interestId, err);
        return { interestId, newAlertCount: 0, totalCollected: 0 };
      } finally {
        inFlightInterestsRef.current.delete(interestId);
        setRefreshingInterestIds((prev) => prev.filter((id) => id !== interestId));
      }
    },
    []
  );

  // refreshAllInterests: process every active interest sequentially. We use
  // the ref to read the *current* list (the interval would otherwise capture
  // a stale snapshot from when it was scheduled).
  const refreshAllInterests = useCallback(async (): Promise<RefreshResult[]> => {
    if (sweepRunningRef.current) return [];
    sweepRunningRef.current = true;
    try {
      const targets = interestsRef.current.filter((i) => i.spec.isActive !== false);
      const results: RefreshResult[] = [];
      for (const i of targets) {
        results.push(await refreshInterest(i.id));
      }
      setLastBackgroundRunAt(new Date().toISOString());
      return results;
    } finally {
      sweepRunningRef.current = false;
    }
  }, [refreshInterest]);

  // Background polling: while enabled, sweep every `autoCollectIntervalMs`.
  // The first sweep fires on mount so the UI feels live immediately.
  useEffect(() => {
    if (!hydrated || !autoCollectEnabled) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (isProcessingInterest) return; // don't fight the add-interest flow
      try {
        await refreshAllInterests();
      } catch {}
    };
    // Stagger initial run so we don't collide with the user's first navigation.
    const firstRun = setTimeout(tick, 5_000);
    const interval = setInterval(tick, autoCollectIntervalMs);
    return () => {
      cancelled = true;
      clearTimeout(firstRun);
      clearInterval(interval);
    };
  }, [hydrated, autoCollectEnabled, autoCollectIntervalMs, refreshAllInterests, isProcessingInterest]);

  const savedAlerts = alerts.filter((a) => a.isSaved);
  const unreadCount = alerts.filter((a) => !a.feedback).length;

  return (
    <AppContext.Provider
      value={{
        interests,
        alerts,
        matches,
        isProcessingInterest,
        addInterest,
        deleteInterest,
        toggleSaveAlert,
        setAlertFeedback,
        hideAlert,
        updateMatchStatus,
        markInterestViewed,
        getNewAlertCount,
        savedAlerts,
        unreadCount,
        refreshInterest,
        refreshAllInterests,
        refreshingInterestIds,
        lastBackgroundRunAt,
        autoCollectEnabled,
        setAutoCollectEnabled,
        autoCollectIntervalMs,
        setAutoCollectIntervalMs,
      }}
    >
      {hydrated ? children : null}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
