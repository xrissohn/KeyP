/**
 * Standalone production server for Expo static builds.
 *
 * Routing:
 * - GET / or /manifest with expo-platform header → native platform manifest JSON
 * - GET / and other navigation paths → web SPA (static-build/web/index.html) when present
 * - Static assets (web bundle + native bundle) → static-build/{web,<timestamp>}/...
 * - Fallback (legacy): landing page HTML when no web build exists
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const WEB_ROOT = path.join(STATIC_ROOT, "web");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Manifest not found for platform: ${platform}` }));
    return;
  }
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function sendFile(filePath, res, statusCode = 200, extraHeaders = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  // Cache hashed assets aggressively, never cache HTML/manifest.
  const isHtml = ext === ".html" || ext === ".webmanifest";
  const cacheControl = isHtml
    ? "no-cache, no-store, must-revalidate"
    : "public, max-age=31536000, immutable";
  res.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": cacheControl,
    ...extraHeaders,
  });
  res.end(content);
}

function safeJoin(root, urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function tryServeWeb(pathname, res) {
  if (!fs.existsSync(WEB_ROOT)) return false;

  // Root → SPA index.
  if (pathname === "/" || pathname === "") {
    const indexPath = path.join(WEB_ROOT, "index.html");
    if (fs.existsSync(indexPath)) {
      sendFile(indexPath, res);
      return true;
    }
    return false;
  }

  const candidate = safeJoin(WEB_ROOT, pathname);
  if (!candidate) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    sendFile(candidate, res);
    return true;
  }

  // Try .html suffix (Expo static route exports).
  const htmlCandidate = candidate + ".html";
  if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
    sendFile(htmlCandidate, res);
    return true;
  }

  // SPA fallback for path-like URLs without an extension.
  if (!path.extname(pathname)) {
    const indexPath = path.join(WEB_ROOT, "index.html");
    if (fs.existsSync(indexPath)) {
      sendFile(indexPath, res);
      return true;
    }
  }

  return false;
}

function tryServeNative(pathname, res) {
  const candidate = safeJoin(STATIC_ROOT, pathname);
  if (!candidate) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    sendFile(candidate, res);
    return true;
  }
  return false;
}

const landingPageTemplate = (() => {
  try {
    return fs.readFileSync(TEMPLATE_PATH, "utf-8");
  } catch {
    return null;
  }
})();
const appName = getAppName();

function serveLandingPage(req, res) {
  if (!landingPageTemplate) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
    return;
  }
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, host)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache, no-store, must-revalidate",
  });
  res.end(html);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  const platform = req.headers["expo-platform"];

  // Native Expo Go manifest endpoints (must take precedence).
  if (pathname === "/manifest" && (platform === "ios" || platform === "android")) {
    return serveManifest(platform, res);
  }
  if (pathname === "/" && (platform === "ios" || platform === "android")) {
    return serveManifest(platform, res);
  }

  // Web SPA / static web assets.
  if (tryServeWeb(pathname, res)) return;

  // Native bundle assets (timestamped dirs, /ios/, /android/).
  if (tryServeNative(pathname, res)) return;

  // Final fallback — legacy landing page so the deployment never 404s at root.
  if (pathname === "/") {
    return serveLandingPage(req, res);
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not Found");
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
  console.log(`Web SPA: ${fs.existsSync(WEB_ROOT) ? "enabled" : "not built"}`);
});
