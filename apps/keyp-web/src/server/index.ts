import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { ZodError } from "zod";
import { runRequestSchema } from "../shared/contracts.js";
import { createDemoRun } from "./demo.js";
import { loadEnvironment } from "./env.js";
import { runLiveSwarm } from "./live.js";

loadEnvironment();

const app = express();
const port = Number(process.env.PORT || 4173);
const configuredLiveRunLimit = Number(process.env.KEYP_LIVE_RUN_LIMIT || 6);
const liveRunLimit = Number.isFinite(configuredLiveRunLimit)
  ? Math.max(1, configuredLiveRunLimit)
  : 6;
const liveRunWindowMs = 10 * 60 * 1_000;
const liveRunWindows = new Map<string, { count: number; resetsAt: number }>();
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = [
  resolve(moduleDirectory, "../.."),
  resolve(moduleDirectory, ".."),
  process.cwd(),
].find((candidate) => existsSync(resolve(candidate, "index.html")));

if (!packageRoot) throw new Error("Could not locate the KeyP web package root");

app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  if (process.env.NODE_ENV === "production") {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
  }
  next();
});
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "keyp-web",
    model: process.env.KEYP_MODEL || "gpt-5.6",
    liveReady: Boolean(process.env.OPENAI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/runs", async (request, response) => {
  const started = Date.now();
  try {
    const input = runRequestSchema.parse(request.body);
    const forceDemo = process.env.KEYP_DEMO_MODE === "true";
    if (input.mode === "live" && !forceDemo) {
      const key = request.ip || "unknown";
      const now = Date.now();
      if (liveRunWindows.size >= 2_000) {
        for (const [windowKey, value] of liveRunWindows) {
          if (value.resetsAt <= now) liveRunWindows.delete(windowKey);
        }
        if (liveRunWindows.size >= 2_000) {
          const oldestKey = liveRunWindows.keys().next().value as string | undefined;
          if (oldestKey) liveRunWindows.delete(oldestKey);
        }
      }
      const current = liveRunWindows.get(key);
      const window = !current || current.resetsAt <= now
        ? { count: 0, resetsAt: now + liveRunWindowMs }
        : current;
      if (window.count >= liveRunLimit) {
        response.setHeader("Retry-After", Math.ceil((window.resetsAt - now) / 1_000));
        response.status(429).json({
          error: "rate_limited",
          message: "Live mode limit reached. Use Demo or try again shortly.",
        });
        return;
      }
      window.count += 1;
      liveRunWindows.set(key, window);
    }
    const result =
      input.mode === "demo" || forceDemo
        ? createDemoRun({ ...input, mode: "demo" })
        : await runLiveSwarm(input);
    response.setHeader("Cache-Control", "no-store");
    response.json(result);
  } catch (error) {
    const status = error instanceof ZodError ? 400 : 500;
    console.error("[KeyP] run failed", {
      durationMs: Date.now() - started,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    response.status(status).json({
      error: status === 400 ? "invalid_request" : "run_failed",
      message:
        error instanceof ZodError
          ? error.issues.map((issue) => issue.message).join(", ")
          : error instanceof Error
            ? error.message
            : "KeyP could not complete this run.",
    });
  }
});

if (process.env.NODE_ENV === "development") {
  const vite = await createViteServer({
    root: packageRoot,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const dist = resolve(packageRoot, "dist");
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.use((_request, response) => {
    response.sendFile(resolve(dist, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`[KeyP] web app listening on http://0.0.0.0:${port}`);
});
