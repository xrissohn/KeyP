import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth as useClerkAuth, useUser } from '@clerk/expo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@/types';
import { setClerkTokenProvider } from '@/lib/agents/ApiClient';
import { isAdminEmail } from '@/lib/admin';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isOnboarded: boolean;
  /** Mirrored from the client-side admin email list — see lib/admin.ts. */
  isAdmin: boolean;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEYS = {
  ONBOARDED: '@keyp/onboarded',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, signOut, getToken } = useClerkAuth();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();

  // Plumb Clerk's session token into the API client so admin endpoints +
  // generate-alerts can authenticate as the signed-in user. Cleared on
  // unmount so signed-out callers don't accidentally reuse a stale token.
  useEffect(() => {
    setClerkTokenProvider(() => getToken());
    return () => setClerkTokenProvider(null);
  }, [getToken]);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardLoaded, setOnboardLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED);
        if (v === 'true') setIsOnboarded(true);
      } catch {
        // ignore
      } finally {
        setOnboardLoaded(true);
      }
    })();
  }, []);

  const user = useMemo<User | null>(() => {
    if (!clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? '';
    const displayName =
      clerkUser.username ??
      clerkUser.firstName ??
      (email ? email.split('@')[0] : '사용자');
    return {
      id: clerkUser.id,
      displayName,
      email,
      bio: '',
      location: '',
      joinedAt: clerkUser.createdAt
        ? new Date(clerkUser.createdAt).toISOString()
        : new Date().toISOString(),
      interestCount: 0,
      alertCount: 0,
      matchCount: 0,
    };
  }, [clerkUser]);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
  }, [signOut]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
    setIsOnboarded(true);
  }, []);

  const isLoading = !clerkLoaded || !userLoaded || !onboardLoaded;
  const isAdmin = isAdminEmail(user?.email);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isOnboarded, isAdmin, logout, completeOnboarding }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
