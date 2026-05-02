import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isOnboarded: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEYS = {
  USER: '@keyp/user',
  ONBOARDED: '@keyp/onboarded',
};

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const [userStr, onboardedStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED),
      ]);
      if (userStr) setUser(JSON.parse(userStr));
      if (onboardedStr === 'true') setIsOnboarded(true);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 1000));
    const mockUser: User = {
      id: generateId(),
      displayName: email.split('@')[0],
      email,
      bio: '',
      location: '',
      joinedAt: new Date().toISOString(),
      interestCount: 0,
      alertCount: 0,
      matchCount: 0,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mockUser));
    setUser(mockUser);
  }, []);

  const register = useCallback(async (displayName: string, email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 1000));
    const newUser: User = {
      id: generateId(),
      displayName,
      email,
      bio: '',
      location: '',
      joinedAt: new Date().toISOString(),
      interestCount: 0,
      alertCount: 0,
      matchCount: 0,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    setUser(null);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
    setIsOnboarded(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isOnboarded, login, register, logout, completeOnboarding }}
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
