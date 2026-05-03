import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
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

// Web-only safety net: swallow background-poller fetch failures so they don't
// pop the Expo Web LogBox "Uncaught Error: Failed to fetch" overlay. Real
// callers (generateAlertsForSpec, refreshInterest) already catch and fall back
// gracefully — this just suppresses the spurious overlay caused by browser
// extensions hijacking fetch and emitting the rejection before our async/await
// chain attaches its handler. We log a warning so developers can still notice.
if (typeof window !== "undefined" && !(window as { __keypFetchGuardInstalled?: boolean }).__keypFetchGuardInstalled) {
  (window as { __keypFetchGuardInstalled?: boolean }).__keypFetchGuardInstalled = true;
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason as { message?: string; name?: string } | undefined;
    const msg = reason?.message ?? String(reason ?? "");
    const name = reason?.name ?? "";
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("Network request failed") ||
      msg.includes("NetworkError") ||
      name === "AbortError"
    ) {
      // eslint-disable-next-line no-console
      console.warn("[KeyP] suppressed transient network rejection:", msg);
      ev.preventDefault();
    }
  });
}

const queryClient = new QueryClient();

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
  );
}
