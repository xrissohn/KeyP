import { Router, type IRouter } from "express";
import { probeUrl, assertSafeUrl } from "./agents";

const router: IRouter = Router();

// Click-time URL safety net.
//
// Even with the upstream URL gate, dead/soft-404 links occasionally slip
// through (LLM hallucinations, soft-404 SPAs, links that died after we
// generated the alert and cached it on-device). The client routes EVERY
// alert tap through this endpoint, which:
//
//   1. SSRF-validates the destination URL (assertSafeUrl).
//   2. Performs a fresh GET probe + soft-404 sniff (probeUrl).
//   3. If alive  → 302 → original URL.
//   4. If dead   → 302 → Google search for the alert title/topic so the
//                   user always lands somewhere useful instead of seeing
//                   a "page not found" wall.
//
// Query params:
//   u  (required) — destination URL (URL-encoded)
//   q  (optional) — fallback search query (URL-encoded)
router.get("/redirect", async (req, res) => {
  const u = typeof req.query["u"] === "string" ? req.query["u"] : "";
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  const fallbackSearch = q
    ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
    : "https://www.google.com";

  if (!u) {
    res.redirect(302, fallbackSearch);
    return;
  }

  // SSRF + protocol gate. If invalid, bail to fallback search.
  try {
    await assertSafeUrl(u);
  } catch (err) {
    req.log.warn({ url: u, err }, "[redirect] blocked unsafe URL");
    res.redirect(302, fallbackSearch);
    return;
  }

  // Fresh reachability probe. We deliberately do NOT cache here — the whole
  // point is to catch links that just died.
  const probe = await probeUrl(u, 5000);
  if (probe.ok) {
    res.redirect(302, u);
    return;
  }
  req.log.info(
    { url: u, reason: probe.reason, fallbackQuery: q },
    "[redirect] dead link → fallback search",
  );
  res.redirect(302, fallbackSearch);
});

export default router;
