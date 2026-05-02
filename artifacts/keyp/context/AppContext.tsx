import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MOCK_ALERTS, MOCK_INTERESTS, MOCK_MATCHES } from '@/data/mockData';
import { generateAlertsForSpec } from '@/lib/agents/MockPipeline';
import { parseInterest } from '@/lib/agents/PlannerAgent';
import type { AgentStep } from '@workspace/api-client-react';
import type { Alert, FeedbackType, Interest, InterestSpec, Match } from '@/types';

export interface AddInterestResult {
  spec: InterestSpec;
  steps: AgentStep[];
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
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  INTERESTS: '@keyp/interests',
  ALERTS: '@keyp/alerts',
  MATCHES: '@keyp/matches',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [interests, setInterests] = useState<Interest[]>(MOCK_INTERESTS);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);
  const [isProcessingInterest, setIsProcessingInterest] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
      const [iStr, aStr, mStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INTERESTS),
        AsyncStorage.getItem(STORAGE_KEYS.ALERTS),
        AsyncStorage.getItem(STORAGE_KEYS.MATCHES),
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
    } catch {
      // use mock defaults already in initial state
    } finally {
      setHydrated(true);
    }
  };

  const addInterest = useCallback(async (
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

      // Use spec.id as the interest id so alerts (which reference spec.id as their
      // interestId) line up with the user-facing interest record. Without this,
      // the detail screen filters by interest.id but alerts carry spec.id and
      // never match — making the history view permanently empty.
      const newInterest: Interest = {
        id: spec.id,
        displayName: spec.topic,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        color: INTEREST_COLORS[Math.floor(Math.random() * INTEREST_COLORS.length)],
        spec,
        alertCount: 0,
        lastAlertAt: undefined,
      };
      if (newInterest.id !== newInterest.spec.id) {
        // Should be unreachable, but log if it ever drifts so we catch it early.
        console.warn(
          '[KeyP] invariant violated: Interest.id !== Interest.spec.id',
          { interestId: newInterest.id, specId: newInterest.spec.id }
        );
      }

      setInterests((prev) => [newInterest, ...prev]);

      const { alerts: newAlerts, steps: collectorSteps } = await generateAlertsForSpec(spec, 3);
      onSteps?.([...plannerSteps, ...collectorSteps]);

      setAlerts((prev) => [...newAlerts, ...prev]);
      setInterests((prev) =>
        prev.map((i) =>
          i.id === newInterest.id
            ? { ...i, alertCount: newAlerts.length, lastAlertAt: new Date().toISOString() }
            : i
        )
      );

      return { spec, steps: [...plannerSteps, ...collectorSteps] };
    } finally {
      setIsProcessingInterest(false);
    }
  }, []);

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
