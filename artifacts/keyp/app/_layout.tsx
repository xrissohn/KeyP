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

// PWA bootstrap (web only). Runs once per session in dev and prod, since
// Expo's `+html.tsx` is only used during static export and the dev shell
// is otherwise minimal.
if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  !(window as { __keypPwaInstalled?: boolean }).__keypPwaInstalled
) {
  (window as { __keypPwaInstalled?: boolean }).__keypPwaInstalled = true;
  const head = document.head;
  const ensureLink = (rel: string, href: string, type?: string) => {
    if (head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    if (type) link.type = type;
    head.appendChild(link);
  };
  const ensureMeta = (name: string, content: string) => {
    let meta = head.querySelector(
      `meta[name="${name}"]`,
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = name;
      head.appendChild(meta);
    }
    meta.content = content;
  };
  ensureLink("manifest", "/manifest.webmanifest");
  const ensureSizedLink = (
    rel: string,
    href: string,
    sizes: string,
    type?: string,
  ) => {
    if (head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    link.setAttribute("sizes", sizes);
    if (type) link.type = type;
    head.appendChild(link);
  };
  ensureSizedLink("icon", "/icon-192.png", "192x192", "image/png");
  ensureSizedLink("icon", "/icon-512.png", "512x512", "image/png");
  ensureLink("shortcut icon", "/icon-mark.png", "image/png");
  ensureSizedLink("apple-touch-icon", "/icon-192.png", "192x192");
  ensureSizedLink("apple-touch-icon", "/icon-512.png", "512x512");
  ensureLink("apple-touch-icon", "/icon.png");
  ensureMeta("theme-color", "#5B7FFF");
  ensureMeta("apple-mobile-web-app-capable", "yes");
  ensureMeta("mobile-web-app-capable", "yes");
  ensureMeta("apple-mobile-web-app-title", "KeyP");
  ensureMeta(
    "description",
    "관심사를 등록하고 실시간 속보를 가장 먼저 받아보세요.",
  );
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }

  // Android Chrome install banner. Captures `beforeinstallprompt`, then
  // shows a small bottom-anchored card prompting the user to install KeyP
  // as a PWA. Hidden once installed, dismissed, or already in standalone.
  type BIPEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  const STORAGE_KEY = "keyp.pwa.installDismissedAt";
  const isStandalone = () => {
    try {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari
        (window.navigator as { standalone?: boolean }).standalone === true
      );
    } catch {
      return false;
    }
  };
  const recentlyDismissed = () => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (!v) return false;
      const ts = Number(v);
      if (!Number.isFinite(ts)) return false;
      // Re-show after 14 days.
      return Date.now() - ts < 14 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };
  const showBanner = (onInstall: () => void) => {
    if (document.getElementById("keyp-pwa-banner")) return;
    const wrap = document.createElement("div");
    wrap.id = "keyp-pwa-banner";
    wrap.setAttribute(
      "style",
      [
        "position:fixed",
        "left:12px",
        "right:12px",
        "bottom:12px",
        "z-index:2147483647",
        "background:#ffffff",
        "color:#0F172A",
        "border:1px solid #E2E8F0",
        "border-radius:14px",
        "box-shadow:0 10px 30px rgba(15,23,42,0.18)",
        "padding:12px 14px",
        "display:flex",
        "align-items:center",
        "gap:12px",
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Noto Sans KR',sans-serif",
      ].join(";"),
    );
    wrap.innerHTML = `
      <img src="/icon-192.png" width="40" height="40" alt="KeyP" style="border-radius:10px;flex-shrink:0" />
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;line-height:1.2">앱으로 설치하기</div>
        <div style="font-size:12px;color:#475569;line-height:1.3;margin-top:2px">홈 화면에 추가하면 더 빠르고 알림처럼 사용할 수 있어요.</div>
      </div>
      <button id="keyp-pwa-dismiss" style="background:transparent;border:0;color:#64748B;font-size:13px;padding:8px 6px;cursor:pointer">나중에</button>
      <button id="keyp-pwa-install" style="background:#5B7FFF;color:#fff;border:0;border-radius:10px;font-size:13px;font-weight:700;padding:10px 14px;cursor:pointer">설치</button>
    `;
    document.body.appendChild(wrap);
    const remove = () => {
      wrap.remove();
    };
    wrap.querySelector("#keyp-pwa-dismiss")?.addEventListener("click", () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {}
      remove();
    });
    wrap.querySelector("#keyp-pwa-install")?.addEventListener("click", () => {
      remove();
      onInstall();
    });
  };

  let deferredPrompt: BIPEvent | null = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    if (isStandalone() || recentlyDismissed()) return;
    showBanner(() => {
      const p = deferredPrompt;
      deferredPrompt = null;
      if (!p) return;
      p.prompt()
        .then(() => p.userChoice)
        .then((choice) => {
          if (choice.outcome === "dismissed") {
            try {
              window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
            } catch {}
          }
        })
        .catch(() => undefined);
    });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    document.getElementById("keyp-pwa-banner")?.remove();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
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
