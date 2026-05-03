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
import { initNotifications, notifyFreshAlerts } from '@/lib/notifications';
import { getDeviceId } from '@/lib/deviceId';
import {
  callTrackInterest,
  callUntrackInterest,
  callSetPlan,
  callBoost,
  type PlanTier,
} from '@/lib/agents/ApiClient';
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
  /**
   * Force-upgrade any saved alerts that still carry placeholder URLs (seeded
   * dummies) by re-running the collector for their parent interests. Safe to
   * call repeatedly; no-ops when nothing needs upgrading.
   */
  upgradeSavedDummies: () => Promise<void>;
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
  // ─── Plan / billing ───────────────────────────────────
  /** Current subscription plan. */
  plan: PlanTier;
  /** Whether user picked annual billing (informational; -20% price). */
  annualBilling: boolean;
  /** Update plan + billing cadence; syncs to server so the poller picks up. */
  setPlan: (plan: PlanTier, annual?: boolean) => Promise<void>;
  /** Trigger an immediate sweep for one interest (속보). */
  boostInterest: (interestId: string) => Promise<{
    ok: boolean;
    reason?: string;
    used: number;
    quota: number;
    remaining: number;
  }>;
}

export type { PlanTier };

const AppContext = createContext<AppContextType | null>(null);

// v2: bumped to discard legacy mock-seeded interests/alerts (which contained
// dummy bookmarks with placeholder URLs). Every user starts fresh; the only
// data is what the agent pipeline collects in real time.
const STORAGE_KEYS = {
  INTERESTS: '@keyp/v2/interests',
  ALERTS: '@keyp/v2/alerts',
  MATCHES: '@keyp/v2/matches',
  AUTO_COLLECT: '@keyp/v2/autoCollect',
  PLAN: '@keyp/v2/plan',
};

// Polling default tightened from 2min → 15min to align with Basic-tier
// economics ($0.084/cycle × 96 cycles/day = $8/interest/month). Plans can
// override this on the server side; the client-side foreground refresh just
// follows the same default cadence.
const DEFAULT_AUTO_COLLECT_INTERVAL_MS = 15 * 60 * 1000;
// Per-interest cooldown so manual + automatic refreshes don't double-fire.
const REFRESH_COOLDOWN_MS = 60 * 1000;
// How many alerts to ask the collector for per refresh sweep.
const REFRESH_BATCH_SIZE = 5;
// Placeholder URLs are bare domains (e.g. https://x.com, https://youtube.com,
// https://example.com) — not real article links. Saved alerts with these
// URLs come from the seed mock data and need to be upgraded to real ones on
// first boot so the "저장한 알림" list contains genuine summaries + links.
const PLACEHOLDER_URL_HOSTS = new Set([
  'x.com',
  'twitter.com',
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'example.com',
]);
const isPlaceholderUrl = (url?: string): boolean => {
  if (!url) return true;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    return PLACEHOLDER_URL_HOSTS.has(u.hostname.toLowerCase()) && path === '';
  } catch {
    return true;
  }
};

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
  const [plan, setPlanState] = useState<PlanTier>('free');
  const [annualBilling, setAnnualBilling] = useState<boolean>(false);

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
    // Request notification permission early so the very first new alert can
    // surface as a push without an in-flight permission prompt delay.
    initNotifications().catch(() => {});
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
      // One-time cleanup of legacy v1 keys (which held mock-seeded interests
      // + dummy bookmarks). Fire-and-forget; safe to attempt on every boot.
      AsyncStorage.multiRemove([
        '@keyp/interests',
        '@keyp/alerts',
        '@keyp/matches',
        '@keyp/autoCollect',
      ]).catch(() => {});
      const [iStr, aStr, mStr, autoStr, planStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INTERESTS),
        AsyncStorage.getItem(STORAGE_KEYS.ALERTS),
        AsyncStorage.getItem(STORAGE_KEYS.MATCHES),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_COLLECT),
        AsyncStorage.getItem(STORAGE_KEYS.PLAN),
      ]);
      if (planStr) {
        try {
          const parsed = JSON.parse(planStr) as { plan?: PlanTier; annual?: boolean };
          if (parsed.plan && ['free', 'basic', 'pro', 'power'].includes(parsed.plan)) {
            setPlanState(parsed.plan);
          }
          if (typeof parsed.annual === 'boolean') setAnnualBilling(parsed.annual);
        } catch {}
      }
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
          if (typeof cfg.intervalMs === 'number') {
            // Migration: old installs persisted 2-min intervals before the
            // pricing rework. Anything below the new 15-min minimum gets
            // bumped up so the UI matches the actual server cadence.
            const migrated =
              cfg.intervalMs < DEFAULT_AUTO_COLLECT_INTERVAL_MS
                ? DEFAULT_AUTO_COLLECT_INTERVAL_MS
                : cfg.intervalMs;
            setAutoCollectIntervalMs(migrated);
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

        // Seed: fetch ONE most-recent past item so the user sees the very
        // latest known signal for this interest immediately. Going forward,
        // the background collector adds only genuinely new items as they
        // appear, and a push notification fires for each one.
        const { alerts: newAlerts, steps: collectorSteps } = await generateAlertsForSpec(spec, 1);
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

        // Fire a push for the seed alert too — first signal the user sees
        // for this interest. Real-time sweeps will follow as new info appears.
        if (newAlerts.length > 0) {
          notifyFreshAlerts(newAlerts).catch(() => {});
        }

        // Server-side tracking: tells the background poller to monitor this
        // interest so push notifications fire even when the app is closed.
        // Fire-and-forget; failure here doesn't block client-side persistence.
        (async () => {
          try {
            const deviceId = await getDeviceId();
            await callTrackInterest({
              interestId: newInterest.id,
              deviceId,
              spec,
              rawText,
            });
          } catch (err) {
            console.warn('[KeyP] track-interest failed (will rely on client polling):', err);
          }
        })();

        return { spec, steps: [...plannerSteps, ...collectorSteps] };
      } finally {
        setIsProcessingInterest(false);
      }
    },
    []
  );

  const deleteInterest = useCallback((interestId: string) => {
    setInterests((prev) => prev.filter((i) => i.id !== interestId));
    // Stop server-side tracking so the poller no longer fires push for it.
    callUntrackInterest(interestId).catch((err) => {
      console.warn('[KeyP] untrack-interest failed (server may still poll briefly):', err);
    });
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
        // Pass existing alerts (most recent 30) to the server so the Verifier
        // can suppress semantic duplicates server-side, even when a competing
        // outlet has rewritten the same story under a different URL/title.
        const existing = alertsRef.current.filter((a) => a.interestId === interestId);
        const existingSummaries = existing
          .slice()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 30)
          .map((a) => ({ title: a.title, summary: a.summary }));

        const { alerts: incoming } = await generateAlertsForSpec(
          interest.spec,
          REFRESH_BATCH_SIZE,
          existingSummaries
        );

        // Client-side dedupe: URL match, normalized-title match, AND a token
        // jaccard similarity gate as a final safety net for cross-source
        // duplicates the server may have missed. KeyP's prime directive is
        // "no duplicate alerts even from different outlets".
        const seenUrls = new Set<string>();
        const seenTitles = new Set<string>();
        const normTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
        const tokenize = (s: string) =>
          new Set(
            s
              .toLowerCase()
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .split(/\s+/)
              .filter((w) => w.length >= 2)
          );
        const jaccard = (a: Set<string>, b: Set<string>) => {
          if (a.size === 0 || b.size === 0) return 0;
          let inter = 0;
          a.forEach((x) => {
            if (b.has(x)) inter += 1;
          });
          return inter / (a.size + b.size - inter);
        };
        const existingFingerprints: Set<string>[] = [];
        existing.forEach((a) => {
          const url = a.source?.url ?? a.originalUrl;
          if (url) seenUrls.add(url);
          seenTitles.add(normTitle(a.title));
          existingFingerprints.push(tokenize(`${a.title} ${a.summary}`));
        });

        const fresh: Alert[] = [];
        for (const a of incoming) {
          const url = a.source?.url ?? a.originalUrl;
          const titleKey = normTitle(a.title);
          if (url && seenUrls.has(url)) continue;
          if (seenTitles.has(titleKey)) continue;
          const fp = tokenize(`${a.title} ${a.summary}`);
          const isSemanticDup = existingFingerprints.some(
            (ef) => jaccard(ef, fp) >= 0.55
          );
          if (isSemanticDup) continue;
          fresh.push({ ...a, createdAt: new Date().toISOString(), freshness: 'live' });
          if (url) seenUrls.add(url);
          seenTitles.add(titleKey);
          existingFingerprints.push(fp);
        }

        const nowIso = new Date().toISOString();
        if (fresh.length > 0) {
          setAlerts((prev) => {
            // Migrate any dummy bookmarks (saved alerts with placeholder URLs
            // — e.g. https://youtube.com from the seed mock data) for THIS
            // interest onto the freshest *real-URL* alert so the saved-알림
            // list gets a genuine summary + link. We only migrate when at
            // least one fresh alert has a non-placeholder URL; otherwise we
            // keep the dummy bookmarks intact and wait for a better sweep.
            const realFresh = fresh.filter(
              (a) => !isPlaceholderUrl(a.source?.url ?? a.originalUrl)
            );
            const dummies = prev.filter(
              (a) =>
                a.interestId === interestId &&
                a.isSaved &&
                isPlaceholderUrl(a.source?.url ?? a.originalUrl)
            );
            if (dummies.length === 0 || realFresh.length === 0) {
              return [...fresh, ...prev];
            }
            // Pick the freshest real alert by createdAt as the migration
            // target. Preserve any dummy's feedback (prefer the most recent
            // dummy with a feedback set).
            const target = [...realFresh].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )[0];
            const preservedFeedback =
              dummies.find((d) => d.feedback)?.feedback ?? undefined;
            const dummyIds = new Set(dummies.map((d) => d.id));
            const freshToAdd = fresh.map((a) =>
              a.id === target.id
                ? { ...a, isSaved: true, feedback: preservedFeedback }
                : a
            );
            const cleared = prev.map((a) =>
              dummyIds.has(a.id)
                ? { ...a, isSaved: false, feedback: undefined }
                : a
            );
            return [...freshToAdd, ...cleared];
          });
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

        // Push notification for the freshest new alert (skips when 0 new).
        if (fresh.length > 0) {
          notifyFreshAlerts(fresh).catch(() => {});
        }

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

  // Force-fetch a fresh batch for every interest that still has a dummy
  // saved bookmark, so the sweep-time migration inside `refreshInterest`
  // can promote a real alert into the saved list. Used by the /saved screen
  // on mount as a safety net for cases where the background sweep hasn't
  // completed (e.g. very short sessions).
  const upgradeSavedDummies = useCallback(async (): Promise<void> => {
    const dummies = alertsRef.current.filter(
      (a) => a.isSaved && isPlaceholderUrl(a.source?.url ?? a.originalUrl)
    );
    if (dummies.length === 0) return;
    const interestIds = Array.from(new Set(dummies.map((d) => d.interestId)));
    for (const id of interestIds) {
      // Skip if a real alert (saved or not) is ALREADY available — eager
      // migration or a prior sweep handles it. Avoids needless API churn.
      const hasReal = alertsRef.current.some(
        (a) =>
          a.interestId === id &&
          !isPlaceholderUrl(a.source?.url ?? a.originalUrl)
      );
      if (hasReal) continue;
      try {
        await refreshInterest(id);
      } catch {}
    }
  }, [refreshInterest]);

  // Eager bookmark migration: as soon as the app hydrates, look at the
  // currently-loaded alerts and, for any saved alert that still carries a
  // placeholder URL (a leftover dummy from the seed mock data), try to
  // migrate the bookmark onto a genuine alert that's ALREADY been collected
  // for the same interest in a prior session and persisted in storage. This
  // makes the saved-알림 list show real summaries+links immediately on boot
  // without waiting for the next 60s sweep cycle. The sweep-time migration
  // inside `refreshInterest` covers the cold-start case where no real alerts
  // exist yet.
  const eagerMigrationRanRef = useRef(false);
  useEffect(() => {
    if (!hydrated || eagerMigrationRanRef.current) return;
    eagerMigrationRanRef.current = true;
    setAlerts((prev) => {
      const dummies = prev.filter(
        (a) => a.isSaved && isPlaceholderUrl(a.source?.url ?? a.originalUrl)
      );
      if (dummies.length === 0) return prev;
      let next = prev;
      let changed = false;
      for (const dummy of dummies) {
        // Pick the freshest real alert (by createdAt) in the same interest
        // that's not the dummy itself and has a real (non-placeholder) URL.
        const candidates = next.filter(
          (a) =>
            a.id !== dummy.id &&
            a.interestId === dummy.interestId &&
            !isPlaceholderUrl(a.source?.url ?? a.originalUrl)
        );
        if (candidates.length === 0) continue;
        const replacement = candidates.reduce((best, cur) =>
          new Date(cur.createdAt).getTime() >
          new Date(best.createdAt).getTime()
            ? cur
            : best
        );
        next = next.map((a) => {
          if (a.id === dummy.id) {
            return { ...a, isSaved: false, feedback: undefined };
          }
          if (a.id === replacement.id) {
            return { ...a, isSaved: true, feedback: dummy.feedback };
          }
          return a;
        });
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [hydrated]);

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

  // Persist plan + sync to server. Server stores it in the spec JSON of every
  // tracked interest so the poller automatically uses the new cadence on its
  // next tick — no restart required.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEYS.PLAN,
      JSON.stringify({ plan, annual: annualBilling }),
    ).catch(() => {});
  }, [plan, annualBilling, hydrated]);

  const setPlan = useCallback(
    async (next: PlanTier, annual?: boolean) => {
      setPlanState(next);
      if (typeof annual === 'boolean') setAnnualBilling(annual);
      try {
        const deviceId = await getDeviceId();
        await callSetPlan({ deviceId, plan: next });
      } catch (err) {
        console.warn('[KeyP] setPlan server sync failed', err);
      }
    },
    [],
  );

  const boostInterest = useCallback(async (interestId: string) => {
    const deviceId = await getDeviceId();
    return callBoost({ deviceId, interestId });
  }, []);

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
        upgradeSavedDummies,
        refreshingInterestIds,
        lastBackgroundRunAt,
        autoCollectEnabled,
        setAutoCollectEnabled,
        autoCollectIntervalMs,
        setAutoCollectIntervalMs,
        plan,
        annualBilling,
        setPlan,
        boostInterest,
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
