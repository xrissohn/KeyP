import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MOCK_ALERTS, MOCK_INTERESTS, MOCK_MATCHES } from '@/data/mockData';
import { generateAlertsForSpec } from '@/lib/agents/MockPipeline';
import { parseInterest } from '@/lib/agents/PlannerAgent';
import type { Alert, FeedbackType, Interest, InterestSpec, Match } from '@/types';

interface AppContextType {
  interests: Interest[];
  alerts: Alert[];
  matches: Match[];
  isProcessingInterest: boolean;
  addInterest: (userId: string, rawText: string) => Promise<InterestSpec>;
  deleteInterest: (interestId: string) => void;
  toggleSaveAlert: (alertId: string) => void;
  setAlertFeedback: (alertId: string, feedback: FeedbackType) => void;
  hideAlert: (alertId: string) => void;
  updateMatchStatus: (matchId: string, status: Match['status']) => void;
  savedAlerts: Alert[];
  unreadCount: number;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  INTERESTS: '@keyp/interests',
  ALERTS: '@keyp/alerts',
  MATCHES: '@keyp/matches',
};

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [interests, setInterests] = useState<Interest[]>(MOCK_INTERESTS);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);
  const [isProcessingInterest, setIsProcessingInterest] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, []);

  const loadFromStorage = async () => {
    try {
      const [iStr, aStr, mStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INTERESTS),
        AsyncStorage.getItem(STORAGE_KEYS.ALERTS),
        AsyncStorage.getItem(STORAGE_KEYS.MATCHES),
      ]);
      if (iStr) setInterests(JSON.parse(iStr));
      if (aStr) setAlerts(JSON.parse(aStr));
      if (mStr) setMatches(JSON.parse(mStr));
    } catch {
      // use mock defaults
    } finally {
      setHydrated(true);
    }
  };

  const persist = async (key: string, data: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch {}
  };

  const addInterest = useCallback(async (userId: string, rawText: string): Promise<InterestSpec> => {
    setIsProcessingInterest(true);
    try {
      const spec = await parseInterest(userId, rawText);
      const INTEREST_COLORS = ['#5B7FFF', '#FF6B8A', '#4ADE80', '#FBBF24', '#A78BFA', '#34D399'];
      const EMOJIS = ['⭐', '🎯', '🔥', '✨', '🚀', '💡', '🎵', '🌟'];

      const newInterest: Interest = {
        id: generateId(),
        displayName: spec.topic,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        color: INTEREST_COLORS[Math.floor(Math.random() * INTEREST_COLORS.length)],
        spec,
        alertCount: 0,
        lastAlertAt: undefined,
      };

      const updated = [newInterest, ...interests];
      setInterests(updated);
      persist(STORAGE_KEYS.INTERESTS, updated);

      // Generate alerts in background
      generateAlertsForSpec(spec, 3).then((newAlerts) => {
        setAlerts((prev) => {
          const next = [...newAlerts, ...prev];
          persist(STORAGE_KEYS.ALERTS, next);
          return next;
        });
        setInterests((prev) => {
          const next = prev.map((i) =>
            i.id === newInterest.id
              ? { ...i, alertCount: newAlerts.length, lastAlertAt: new Date().toISOString() }
              : i
          );
          persist(STORAGE_KEYS.INTERESTS, next);
          return next;
        });
      });

      return spec;
    } finally {
      setIsProcessingInterest(false);
    }
  }, [interests]);

  const deleteInterest = useCallback((interestId: string) => {
    setInterests((prev) => {
      const next = prev.filter((i) => i.id !== interestId);
      persist(STORAGE_KEYS.INTERESTS, next);
      return next;
    });
  }, []);

  const toggleSaveAlert = useCallback((alertId: string) => {
    setAlerts((prev) => {
      const next = prev.map((a) =>
        a.id === alertId ? { ...a, isSaved: !a.isSaved } : a
      );
      persist(STORAGE_KEYS.ALERTS, next);
      return next;
    });
  }, []);

  const setAlertFeedback = useCallback((alertId: string, feedback: FeedbackType) => {
    setAlerts((prev) => {
      const next = prev.map((a) =>
        a.id === alertId ? { ...a, feedback } : a
      );
      persist(STORAGE_KEYS.ALERTS, next);
      return next;
    });
  }, []);

  const hideAlert = useCallback((alertId: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== alertId);
      persist(STORAGE_KEYS.ALERTS, next);
      return next;
    });
  }, []);

  const updateMatchStatus = useCallback((matchId: string, status: Match['status']) => {
    setMatches((prev) => {
      const next = prev.map((m) =>
        m.id === matchId ? { ...m, status } : m
      );
      persist(STORAGE_KEYS.MATCHES, next);
      return next;
    });
  }, []);

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
