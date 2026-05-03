import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";

SplashScreen.preventAutoHideAsync();

// Patterns we treat as "transient network noise" and suppress at the
// runtime level so they don't trip a red LogBox overlay. Every legitimate
// caller already catches these and falls back gracefully (refresh poller,
// agent pipeline, push registration, etc.) — this is purely a safety net
// for cases where the rejection escapes the surrounding await chain (e.g.
// browser extensions hijacking fetch on Web, or RN LogBox surfacing a
// possibly-unhandled rejection that resolves a tick too late).
const TRANSIENT_NETWORK_PATTERNS = [
  /Failed to fetch/i,
  /Network request failed/i,
  /NetworkError/i,
  /aborted/i,
  /AbortError/i,
  /timed out/i,
  /KeyP request timeout/i,
];
function isTransientNetworkError(reason: unknown): boolean {
  if (!reason) return false;
  const r = reason as { message?: string; name?: string };
  const msg = r.message ?? String(reason);
  const name = r.name ?? "";
  return TRANSIENT_NETWORK_PATTERNS.some((re) => re.test(msg) || re.test(name));
}

// Web safety net.
if (typeof window !== "undefined" && !(window as { __keypFetchGuardInstalled?: boolean }).__keypFetchGuardInstalled) {
  (window as { __keypFetchGuardInstalled?: boolean }).__keypFetchGuardInstalled = true;
  window.addEventListener("unhandledrejection", (ev) => {
    if (isTransientNetworkError(ev.reason)) {
      // eslint-disable-next-line no-console
      console.warn("[KeyP] suppressed transient network rejection:", ev.reason);
      ev.preventDefault();
    }
  });
}

// React Native safety net. RN routes unhandled rejections through the
// `promise/setimmediate` polyfill — we tap it once so the LogBox doesn't
// pop a "Uncaught Error: signal is aborted without reason" overlay every
// time the 30s API timeout fires on a sleepy dev server. Wrapped in a
// try/catch because the polyfill API is not part of any stable surface.
if (typeof window === "undefined" || typeof document === "undefined") {
  const g = globalThis as {
    __keypRNGuardInstalled?: boolean;
    HermesInternal?: unknown;
  };
  if (!g.__keypRNGuardInstalled) {
    g.__keypRNGuardInstalled = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const tracking = require("promise/setimmediate/rejection-tracking");
      tracking.enable({
        allRejections: true,
        onUnhandled: (id: number, error: unknown) => {
          if (isTransientNetworkError(error)) {
            // eslint-disable-next-line no-console
            console.warn("[KeyP] suppressed transient RN rejection:", error);
            return;
          }
          // eslint-disable-next-line no-console
          console.warn(`Possible unhandled promise rejection (id: ${id}):`, error);
        },
        onHandled: () => {},
      });
    } catch {
      // Best-effort — if the polyfill isn't available, fall back to RN's
      // default behavior. The user-visible impact is at most a LogBox
      // warning, never a functional bug.
    }
  }
}

const queryClient = new QueryClient();

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const CLERK_PROXY_URL = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="interest/add"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen name="interest/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="alert/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="saved" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
      proxyUrl={CLERK_PROXY_URL}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <AuthProvider>
                    <AppProvider>
                      <RootLayoutNav />
                    </AppProvider>
                  </AuthProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
