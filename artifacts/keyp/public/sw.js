/* KeyP service worker — install, fetch caching, web push, badging. */
const CACHE_NAME = "keyp-shell-v4";
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.png",
  "/icon-mark.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API or auth proxy responses.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__clerk")) {
    return;
  }

  // Network-first for navigations; fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/"))),
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(req, copy))
              .catch(() => undefined);
          }
          return res;
        }),
    ),
  );
});

// ─────────────────────────── Web Push ─────────────────────────────────
//
// Server posts JSON via web-push (VAPID-signed). We display a system
// notification and bump the PWA badge so the user sees an unread count
// on the home-screen icon (Android, desktop Chrome, iOS 16.4+ PWA).

self.addEventListener("push", (event) => {
  /** @type {{title?: string, body?: string, url?: string, tag?: string, badge?: number, data?: any}} */
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      try {
        payload = { body: event.data.text() };
      } catch {
        payload = {};
      }
    }
  }
  const title = payload.title || "KeyP";
  const body = payload.body || "";
  const url = payload.url || "/";
  const tag = payload.tag || "keyp-alert";
  const badgeCount = typeof payload.badge === "number" ? payload.badge : null;

  const showPromise = self.registration.showNotification(title, {
    body,
    tag,
    icon: "/icon-192.png",
    badge: "/favicon-32.png",
    data: { ...(payload.data || {}), url },
    renotify: true,
  });

  // App Badging API: best-effort. Not supported everywhere; ignore failures.
  let badgePromise = Promise.resolve();
  if (badgeCount !== null && "setAppBadge" in self.navigator) {
    badgePromise = self.navigator
      .setAppBadge(badgeCount)
      .catch(() => undefined);
  }

  event.waitUntil(Promise.all([showPromise, badgePromise]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if we have one — even if it's not on the
        // exact URL, deep-linking via postMessage is preferable to opening
        // a duplicate tab. For now we just navigate it to the target URL.
        for (const client of clientList) {
          if ("focus" in client) {
            try {
              if ("navigate" in client) client.navigate(url);
              return client.focus();
            } catch {
              // fall through to openWindow
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
        return undefined;
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Browser rotated the subscription (key compromise, expiry, etc.). The
  // client SDK re-subscribes on next page load; nothing to do here besides
  // letting the old subscription die naturally on the server side (404/410
  // eviction in services/webPush.ts).
  event.waitUntil(Promise.resolve());
});
