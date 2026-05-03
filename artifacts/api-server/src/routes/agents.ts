import { Router, type IRouter } from "express";
import {
  ParseInterestBody,
  GenerateAlertsBody,
  ParseInterestResponse,
  GenerateAlertsResponse,
} from "@workspace/api-zod";
import type {
  ParsedInterestResult,
  GeneratedAlertsResult,
  InterestSpecData,
  AgentStep,
  AlertData,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  isBlacklisted,
  addToBlacklist,
  getRecentBlacklistedHosts,
} from "../services/deadUrlBlacklist";
import {
  bumpReputation,
  getReputationForHosts,
  reputationScore,
  formatReputationForPrompt,
  classifyRejectReason,
  hostFromUrl,
  type ReputationLookup,
} from "../services/sourceReputation";
import {
  getProfile,
  scoreCandidate,
  topTokens,
  isProfileEmpty,
  type DeviceProfile,
} from "../services/feedbackProfile";
import { sniffTrends } from "../services/trendSniffer";

const router: IRouter = Router();

const PLANNER_MODEL = "gpt-5.4";
const COLLECTOR_MODEL = "perplexity/sonar-pro";
const VERIFIER_MODEL = "claude-sonnet-4-6";
const PLANNER_MAX_TOKENS = 4096;
const COLLECTOR_MAX_TOKENS = 8192;
const VERIFIER_MAX_TOKENS = 8192;

// ============================================================
// URL reachability gate — drops candidates whose source URL is
// fabricated/dead. Collector LLMs (especially the backup pass)
// sometimes hallucinate plausible-looking news URLs that 404.
// We HEAD-request each candidate URL with a tight timeout and
// drop anything that 404/410/5xxs or fails the network entirely.
// 401/403/405/429 are kept (page exists, just gated/method-blocked).
//
// SSRF DEFENSE: every URL is LLM-supplied and untrusted. Before
// each request we (a) require http(s), (b) reject embedded creds
// and non-default ports, (c) DNS-resolve the host and reject any
// loopback / private / link-local / multicast / metadata range
// (IPv4 + IPv6), and (d) follow redirects MANUALLY so each hop
// is re-validated against the same policy.
// ============================================================
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast/reserved
  return false;
}
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fec0:")) return true; // link/site local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d) — rewalk through v4 check
  const m = lower.match(/^::ffff:([0-9.]+)$/);
  if (m && m[1]) return isPrivateIPv4(m[1]);
  return false;
}
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const u = new URL(rawUrl);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("blocked: non-http(s) protocol");
  }
  if (u.username || u.password) throw new Error("blocked: embedded credentials");
  if (u.port) {
    const p = Number(u.port);
    if (p !== 80 && p !== 443) throw new Error("blocked: non-default port");
  }
  const host = u.hostname;
  const literalKind = isIP(host); // 4, 6, or 0
  if (literalKind === 4) {
    if (isPrivateIPv4(host)) throw new Error("blocked: private IPv4");
  } else if (literalKind === 6) {
    if (isPrivateIPv6(host)) throw new Error("blocked: private IPv6");
  } else {
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
      throw new Error("blocked: local hostname");
    }
    const records = await dnsLookup(host, { all: true });
    for (const r of records) {
      if (r.family === 4 && isPrivateIPv4(r.address)) {
        throw new Error(`blocked: host resolves to private IPv4 ${r.address}`);
      }
      if (r.family === 6 && isPrivateIPv6(r.address)) {
        throw new Error(`blocked: host resolves to private IPv6 ${r.address}`);
      }
    }
  }
  return u;
}

async function fetchWithSafeRedirects(
  startUrl: string,
  init: { method: "HEAD" | "GET"; signal: AbortSignal; headers: Record<string, string> },
  maxHops = 5,
): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertSafeUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("blocked: too many redirects");
}

// Soft-404 detector. Many SPAs / community sites (meetup.com, university KSA
// pages, K-pop fandom sites, etc.) return HTTP 200 even for non-existent
// paths and only show "page not found" in the rendered body. We sniff the
// first ~64KB of the response for these markers in EN/KO/JA before declaring
// the URL truly reachable.
// Soft-404 markers — kept intentionally NARROW to minimize false positives.
// Generic phrases like "not found" appearing anywhere in the body cause many
// real pages (forum threads, news comments) to be misclassified as dead, so
// we only match these phrases when they appear in <title>, headings, or
// adjacent to 404, OR as full localized "page not found" sentences.
const SOFT_404_MARKERS = [
  /<title[^>]*>[^<]{0,80}\b404\b[^<]{0,80}<\/title>/i,
  /<title[^>]*>[^<]{0,120}(?:page\s+not\s+found|not\s+found|doesn'?t\s+exist|no\s+longer\s+available)[^<]{0,80}<\/title>/i,
  /<h1[^>]*>[^<]{0,120}(?:page\s+not\s+found|404\s+not\s+found|doesn'?t\s+exist|no\s+longer\s+available)[^<]{0,80}<\/h1>/i,
  /\bHTTP\s+404\b/,
  /\b404\s*[-—:|]\s*(?:page\s+)?not\s+found\b/i,
  /페이지(?:를|가)?\s*찾을\s*수\s*없/, // 페이지를 찾을 수 없습니다
  /존재하지\s*않는\s*(?:페이지|글|게시물|이벤트)/,
  /삭제(?:된|되었)\s*(?:게시물|페이지|글)/,
  /ページが見つかりません/,            // Japanese
];

async function probeUrl(
  url: string,
  timeoutMs = 6000,
): Promise<{ ok: boolean; reason?: string }> {
  const ua =
    "Mozilla/5.0 (compatible; KeypBot/1.0; +https://keyp.replit.app)";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Always use GET — HEAD lies on too many CDNs / SPAs. We only read the
    // first 64KB of the body for soft-404 sniff to keep this cheap.
    const res = await fetchWithSafeRedirects(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko,en;q=0.8",
      },
    });
    if (res.status === 404 || res.status === 410) {
      const reason = `status_${res.status}`;
      void addToBlacklist(url, reason);
      return { ok: false, reason };
    }
    if (res.status >= 500 && res.status < 600) {
      const reason = `status_${res.status}`;
      void addToBlacklist(url, reason);
      return { ok: false, reason };
    }
    if (res.status >= 400 && res.status !== 401 && res.status !== 403 && res.status !== 405 && res.status !== 429) {
      return { ok: false, reason: `status_${res.status}` };
    }
    // Sniff first ~64KB for soft-404 markers, but only on text/html responses.
    // For non-HTML responses we MUST still drain/cancel the body stream so
    // we don't leak sockets / bandwidth on large binaries.
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html") || ct.includes("application/xhtml")) {
      const reader = res.body?.getReader();
      if (reader) {
        let received = 0;
        const chunks: Uint8Array[] = [];
        const MAX = 64 * 1024;
        while (received < MAX) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
        }
        try { await reader.cancel(); } catch {}
        const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
        const sample = buf.toString("utf8", 0, Math.min(buf.byteLength, MAX));
        for (const re of SOFT_404_MARKERS) {
          if (re.test(sample)) {
            void addToBlacklist(url, "soft_404");
            return { ok: false, reason: "soft_404" };
          }
        }
      }
    } else {
      // Non-HTML (PDF / video / image / JSON). We don't need the body — just
      // cancel so the underlying connection is freed promptly.
      try { await res.body?.cancel(); } catch {}
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function isUrlReachable(url: string): Promise<boolean> {
  const r = await probeUrl(url, 5000);
  return r.ok;
}

export { probeUrl, assertSafeUrl };

async function pruneUnreachableCandidates<
  T extends { url?: string; title: string },
>(
  cands: T[],
  log: { info: (o: object, m: string) => void },
  deviceId?: string | null,
): Promise<T[]> {
  if (cands.length === 0) return cands;
  // Pre-filter using the persistent dead-URL blacklist so we never spend
  // probe latency on URLs we've already proven dead.
  const blacklistChecked = await Promise.all(
    cands.map(async (c) => ({
      c,
      blacklisted: c.url ? await isBlacklisted(c.url) : false,
    })),
  );
  const droppedFromBlacklist = blacklistChecked.filter((x) => x.blacklisted).map((x) => x.c);
  const survivors = blacklistChecked.filter((x) => !x.blacklisted).map((x) => x.c);

  const checks = await Promise.all(
    survivors.map(async (c) => ({
      c,
      ok: c.url ? await isUrlReachable(c.url) : false,
      url: c.url,
    })),
  );
  const kept = checks.filter((x) => x.ok).map((x) => x.c);
  const dropped = checks.filter((x) => !x.ok);
  // Bump per-host deadCount reputation so future Selector pre-rank can
  // down-weight repeat offenders (survives interest deletion).
  const deadHostCounts = new Map<string, number>();
  for (const d of dropped) {
    const h = hostFromUrl(d.url);
    if (h) deadHostCounts.set(h, (deadHostCounts.get(h) ?? 0) + 1);
  }
  for (const b of droppedFromBlacklist) {
    const h = hostFromUrl(b.url);
    if (h) deadHostCounts.set(h, (deadHostCounts.get(h) ?? 0) + 1);
  }
  for (const [host, count] of deadHostCounts) {
    void bumpReputation(host, deviceId ?? null, { deadCount: count });
  }
  if (dropped.length > 0 || droppedFromBlacklist.length > 0) {
    log.info(
      {
        kept: kept.length,
        dropped: dropped.length,
        droppedFromBlacklist: droppedFromBlacklist.length,
        droppedUrls: dropped.slice(0, 3).map((d) => ({
          url: d.url ?? null,
          title: d.c.title.slice(0, 80),
        })),
        blacklistExamples: droppedFromBlacklist.slice(0, 3).map((d) => ({
          url: d.url ?? null,
          title: d.title.slice(0, 80),
        })),
      },
      "[url-gate] dropped candidates with missing/unreachable source URL",
    );
  }
  return kept;
}

function fallbackPlanner(rawText: string): InterestSpecData {
  const lower = rawText.toLowerCase();
  const intentType: InterestSpecData["intentType"] = lower.includes("여행")
    ? "travel"
    : lower.includes("친구") || lower.includes("동행") || lower.includes("같이")
    ? "match"
    : lower.includes("투자") || lower.includes("기회")
    ? "opportunity"
    : lower.includes("크리에이터") || lower.includes("유튜버")
    ? "creator_watch"
    : lower.includes("알림") || lower.includes("속보")
    ? "alert"
    : "monitor";
  const topic = rawText.replace(/알려줘|싶어요|해줘/g, "").trim().slice(0, 30);
  return {
    intentType,
    topic,
    entities: rawText.split(/\s+/).filter((w) => w.length >= 2).slice(0, 5),
    locationScope: undefined,
    urgency: "medium",
    desiredOutcome: `${topic} 관련 동향 추적`,
    trustNeed: "medium",
    matchMode: undefined,
    privacyLevel: intentType === "match" ? "friends" : "public",
    negativeConstraints: [],
    suggestedSources: ["twitter", "youtube", "reddit", "rss"],
    targetPersona: undefined,
    searchStrategy: [],
  };
}

function extractJsonObject(text: string): unknown {
  // Try fenced ```json ... ``` blocks first; otherwise fall back to first {...}.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = fenced ? [fenced[1]!, text] : [text];
  for (const raw of candidates) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) continue;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // Try removing trailing commas, common LLM mistake
      try {
        const cleaned = raw.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1");
        return JSON.parse(cleaned);
      } catch {
        // continue
      }
    }
  }
  throw new Error("No parseable JSON object found in response");
}

router.post("/agents/parse-interest", async (req, res) => {
  const parsed = ParseInterestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { rawText } = parsed.data;
  const steps: AgentStep[] = [];

  const plannerStart = Date.now();
  let spec: InterestSpecData;

  try {
    const completion = await openai.chat.completions.create({
      model: PLANNER_MODEL,
      max_completion_tokens: PLANNER_MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Planner Agent of KeyP — think like a top-tier private investigator / detective. Your job is to read the user's Korean interest in ONE pass and produce both (a) a normalized spec and (b) a concrete, ordered investigation plan that names SPECIFIC platforms, communities, handles, hashtags, or sites where the signal is most likely to appear FIRST.

Respond ONLY with JSON matching this exact schema (no prose, no markdown):
{
  "intentType": "monitor"|"alert"|"opportunity"|"match"|"creator_watch"|"travel"|"local_signal",
  "topic": "<short Korean topic, max 30 chars>",
  "entities": ["<key entity 1>", "<key entity 2>", "..."],
  "locationScope": "<city or region, Korean if natural, or null>",
  "urgency": "high"|"medium"|"low",
  "desiredOutcome": "<one-line Korean outcome statement>",
  "trustNeed": "high"|"medium"|"low",
  "matchMode": "companion"|"friend"|"collaborate"|"meal_mate"|"date"|null,
  "privacyLevel": "public"|"friends"|"private",
  "negativeConstraints": ["<things to avoid in Korean>"],
  "suggestedSources": ["youtube"|"twitter"|"reddit"|"rss"|"match", ...],
  "targetPersona": "<Korean: who/what the user is searching FOR — demographic, location, behavior, intent>",
  "searchStrategy": [
    { "channel": "<specific platform/community/handle/hashtag/site>", "query": "<concrete search phrase>", "rationale": "<one Korean sentence on why this is high-signal>" }
  ]
}

Detective rules — apply ALL:
- INFER context aggressively. From "다음주 뉴욕에 놀러가는데 한국 남성을 만나고 싶어하는 미국 20대 여학생이 있으면 알려줘" you should infer: traveler is the asker; TARGET persona is "뉴욕 거주/체류 한국계 또는 한국 남성에 관심 있는 미국 20대 여대생/직장인"; locationScope="뉴욕"; urgency="high" (다음 주); intentType="match" with matchMode="date".
- searchStrategy: 4–7 entries, ORDERED by likelihood of finding the SPECIFIC target first. Each entry must name a CONCRETE channel — not "Twitter" but "@nyukorean on X", not "Reddit" but "r/AskNYC OR r/nyu OR r/Korean", not "YouTube" but "NYU Korean Student Association YouTube". Include dating/matching apps when relevant ("Hinge NYC filter: Korean preference", "Bumble NYC", "Meeff", "Sakura Live"), location-specific communities (Naver 카페 뉴욕맘/뉴욕코리안, 미시USA, Reddit r/koreanamerican), local university clubs (Columbia/NYU/Fordham KSA), creator channels (NYC Korean lifestyle YouTubers, Threads/Instagram NYC Korean food/lifestyle handles).
- query: phrase that an investigator would actually paste into the channel's search — not generic, mention location + intent + time window when meaningful.
- rationale: prove you understand the persona's habits — "이 커뮤니티는 뉴욕 한인 20대 여성이 데이팅/만남 정보를 가장 활발히 공유하는 곳이라 첫 신호 가능성이 매우 높음."
- suggestedSources: still constrained to the enum, but ORDER it consistently with searchStrategy (e.g. if your top searchStrategy entries are dating-app reviews on Reddit, put "reddit" first).
- intentType=match → matchMode set; otherwise null.
- entities: 3-6 nouns mixing the asker's words AND inferred concepts (locations, platforms, persona traits).
- urgency=high for keywords 긴급/지금/빨리/내일/이번 주/다음 주.
- If the user's text is vague, still produce 4+ searchStrategy entries by inferring the most plausible interpretation — never return an empty searchStrategy.`,
        },
        {
          role: "user",
          content: rawText,
        },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(content) as Record<string, unknown>;
    const rawStrategy = Array.isArray(json.searchStrategy) ? json.searchStrategy : [];
    const searchStrategy = rawStrategy
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .slice(0, 8)
      .map((s) => ({
        channel: String(s.channel ?? "").slice(0, 120),
        query: String(s.query ?? "").slice(0, 200),
        rationale: String(s.rationale ?? "").slice(0, 200),
      }))
      .filter((s) => s.channel.length > 0 && s.query.length > 0);

    spec = {
      intentType: (json.intentType as InterestSpecData["intentType"]) ?? "monitor",
      topic:
        typeof json.topic === "string" && json.topic.length > 0
          ? json.topic
          : rawText.slice(0, 30),
      entities: Array.isArray(json.entities) ? json.entities.slice(0, 6).map(String) : [],
      locationScope: (json.locationScope as string | null | undefined) ?? undefined,
      urgency: (json.urgency as InterestSpecData["urgency"]) ?? "medium",
      desiredOutcome:
        typeof json.desiredOutcome === "string"
          ? json.desiredOutcome
          : `${rawText.slice(0, 20)} 관련 동향 추적`,
      trustNeed: (json.trustNeed as InterestSpecData["trustNeed"]) ?? "medium",
      matchMode: (json.matchMode as InterestSpecData["matchMode"]) ?? undefined,
      privacyLevel: (json.privacyLevel as InterestSpecData["privacyLevel"]) ?? "public",
      negativeConstraints: Array.isArray(json.negativeConstraints)
        ? json.negativeConstraints.map(String)
        : [],
      suggestedSources:
        Array.isArray(json.suggestedSources) && json.suggestedSources.length > 0
          ? (json.suggestedSources as InterestSpecData["suggestedSources"])
          : ["twitter", "youtube", "reddit", "rss"],
      targetPersona:
        typeof json.targetPersona === "string" && json.targetPersona.length > 0
          ? json.targetPersona
          : undefined,
      searchStrategy,
    };
    steps.push({
      agent: "Planner",
      status: "success",
      message: `의도 "${spec.intentType}" 추론 · 페르소나 식별 · 조사 채널 ${searchStrategy.length}개 우선순위화 (GPT-5.4)`,
      durationMs: Date.now() - plannerStart,
    });
  } catch (err) {
    req.log.error({ err }, "Planner agent failed");
    spec = fallbackPlanner(rawText);
    steps.push({
      agent: "Planner",
      status: "partial",
      message: "GPT 호출 실패 — 키워드 기반 폴백 사용",
      durationMs: Date.now() - plannerStart,
    });
  }

  // ─── Trend Sniffer ────────────────────────────────────────────────
  // Two LIVE signals (Google Trends + Perplexity meta-search) reorder the
  // Planner's channel list to put data-corroborated platforms first AND
  // append up to 3 net-new hot channels the Planner missed. This makes
  // "where do we look first?" a data-driven decision instead of relying
  // purely on the Planner LLM's frozen-in-training prior.
  if ((spec.searchStrategy?.length ?? 0) > 0) {
    const snifferStart = Date.now();
    try {
      const sniffed = await sniffTrends({
        topic: spec.topic,
        entities: spec.entities,
        locationScope: spec.locationScope,
        plannerStrategy: spec.searchStrategy ?? [],
        logger: req.log,
      });
      spec.searchStrategy = sniffed.reordered;
      const okSignals = sniffed.evidence
        .filter((e) => e.ok)
        .map((e) => e.source);
      const failedSignals = sniffed.evidence
        .filter((e) => !e.ok)
        .map((e) => e.source);
      const bumpedNote =
        sniffed.bumpedChannels.length > 0
          ? `우선순위 상승: ${sniffed.bumpedChannels.slice(0, 3).join(", ")}`
          : "기존 순서 유지";
      const addedNote =
        sniffed.addedChannels.length > 0
          ? ` · 신규 채널 ${sniffed.addedChannels.length}건 추가`
          : "";
      const cachedNote = sniffed.cached ? " (캐시 hit)" : "";
      // Only call it a "success" when at least one signal was live AND
      // it materially changed the strategy (bumped or added). Live
      // signals that produced zero effect are still "partial" — the
      // observer should know nothing actionable came back.
      const materialChange =
        sniffed.bumpedChannels.length > 0 || sniffed.addedChannels.length > 0;
      steps.push({
        agent: "TrendSniffer",
        status: okSignals.length > 0 && materialChange ? "success" : "partial",
        message: `실시간 신호 ${okSignals.length}/${sniffed.evidence.length} 활성${
          failedSignals.length > 0 ? ` (${failedSignals.join(",")} 실패)` : ""
        } · ${bumpedNote}${addedNote}${cachedNote}`,
        durationMs: sniffed.cached ? 0 : sniffed.durationMs,
      });
    } catch (err) {
      req.log.warn({ err }, "[trend-sniffer] unexpected failure (non-fatal)");
      steps.push({
        agent: "TrendSniffer",
        status: "partial",
        message: "실시간 신호 수집 실패 — Planner 순서 유지",
        durationMs: Date.now() - snifferStart,
      });
    }
  }

  const routerStart = Date.now();
  const topChannel = spec.searchStrategy?.[0]?.channel;
  steps.push({
    agent: "SourceRouter",
    status: "success",
    message: topChannel
      ? `조사 우선 채널: ${topChannel} (총 ${spec.searchStrategy?.length ?? 0}개 채널 큐잉)`
      : `${spec.suggestedSources.length}개 소스 우선순위 계산 (${spec.suggestedSources[0]} 1순위)`,
    durationMs: Date.now() - routerStart + 12,
  });

  const result: ParsedInterestResult = { spec, steps };
  const validation = ParseInterestResponse.safeParse(result);
  if (!validation.success) {
    req.log.warn(
      { issues: validation.error.flatten() },
      "Planner output failed schema validation, using fallback",
    );
    const fallback = fallbackPlanner(rawText);
    const fallbackResult: ParsedInterestResult = {
      spec: fallback,
      steps: [
        ...steps,
        {
          agent: "Validator",
          status: "partial",
          message: "응답 형식 불일치 — 폴백 사용",
          durationMs: 0,
        },
      ],
    };
    res.json(ParseInterestResponse.parse(fallbackResult));
    return;
  }
  res.json(validation.data);
});

interface CollectedCandidate {
  title: string;
  summary: string;
  reason?: string;
  sourceType: AlertData["source"]["type"];
  sourceName: string;
  url?: string;
  minutesAgo: number;
  eventMinutesAgo: number;
  tags: string[];
  originalLanguage?: string;
}

const ALLOWED_LANGS = ["ko", "en", "ja", "zh", "es", "fr", "de", "other"] as const;
type AllowedLang = (typeof ALLOWED_LANGS)[number];
function normalizeLang(v: unknown): AllowedLang {
  if (typeof v !== "string") return "other";
  const lower = v.toLowerCase().slice(0, 5);
  const head = lower.split(/[-_]/)[0] ?? "";
  return (ALLOWED_LANGS as readonly string[]).includes(head)
    ? (head as AllowedLang)
    : "other";
}

// Deterministic Korean-friendly semantic-dedup helpers. Whitespace tokenization
// is unreliable for Korean (agglutinative morphology), so we use character
// bigram Jaccard over a punctuation-stripped (title + summary) string. This
// catches cross-source rewrites of the same story even when the LLM-side
// Verifier missed them. This gate is the LAST line of defense for KeyP's
// prime directive: never alert the user about the same content twice.
function _normalizeForDedup(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}
function _bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
function semanticSimilarity(a: string, b: string): number {
  const na = _normalizeForDedup(a);
  const nb = _normalizeForDedup(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = _bigrams(na);
  const bb = _bigrams(nb);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  const union = ba.size + bb.size - inter;
  return union === 0 ? 0 : inter / union;
}
const SEMANTIC_DUP_THRESHOLD = 0.45;
function isSemanticDupOfAny(
  candidate: { title: string; summary: string },
  known: { title: string; summary: string }[],
): boolean {
  const ct = `${candidate.title} ${candidate.summary}`;
  for (const k of known) {
    const kt = `${k.title} ${k.summary}`;
    if (semanticSimilarity(ct, kt) >= SEMANTIC_DUP_THRESHOLD) return true;
  }
  return false;
}

function effectiveAge(c: { minutesAgo: number; eventMinutesAgo: number }): number {
  // Rank by content recency (when the underlying event actually occurred),
  // not by when an article was republished. If a 1-day-old post merely
  // recaps a 1-year-old story, eventMinutesAgo dwarfs minutesAgo and the
  // item correctly drops behind a slightly older but genuinely-fresh post.
  return Math.max(c.minutesAgo, c.eventMinutesAgo);
}

function defaultSourceType(
  spec: GeneratedAlertsResult extends { alerts: infer _A } ? InterestSpecData : InterestSpecData,
): AlertData["source"]["type"] {
  if (spec.intentType === "match") return "match";
  return spec.suggestedSources[0] ?? "rss";
}

router.post("/agents/generate-alerts", async (req, res) => {
  const parsed = GenerateAlertsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { spec, count, existingAlertSummaries } = parsed.data;
  const requested = count ?? 3;
  const knownItems = (existingAlertSummaries ?? []).slice(0, 40);
  // Personalization pass-through fields. Not part of the shared zod schema
  // (avoids a codegen ripple); we just sniff them off the raw request body.
  const rawBody = (req.body ?? {}) as Record<string, unknown>;
  const deviceId =
    typeof rawBody["deviceId"] === "string" && (rawBody["deviceId"] as string).length > 0
      ? (rawBody["deviceId"] as string)
      : undefined;
  const planRaw = typeof rawBody["plan"] === "string" ? (rawBody["plan"] as string) : "free";
  const plan: "free" | "basic" | "pro" | "power" =
    planRaw === "basic" || planRaw === "pro" || planRaw === "power" ? planRaw : "free";
  // userLanguage controls which language the Verifier translates final title+
  // summary into. Source URLs are NEVER translated (the user opens them in
  // the original language). Whitelisted to ko|en; defaults to 'ko' for
  // backwards compat when the client (or loopback poller) doesn't send it.
  const userLanguageRaw =
    typeof rawBody["userLanguage"] === "string" ? (rawBody["userLanguage"] as string) : "ko";
  const userLanguage: "ko" | "en" =
    userLanguageRaw === "en" ? "en" : "ko";

  // ─── Freshness floor (KeyP prime directive #2) ────────────────────────
  // The client passes the ISO timestamp of the most recent event already
  // delivered for this interest. Any candidate whose underlying event
  // happened BEFORE this floor must NEVER be returned — not from the
  // Collector, not from the Verifier, not from the seed-rescue path. We
  // express the floor as a "max allowed eventMinutesAgo" because that's
  // the unit the Collector and downstream filters work in.
  const latestKnownEventAtRaw =
    typeof rawBody["latestKnownEventAt"] === "string"
      ? (rawBody["latestKnownEventAt"] as string)
      : undefined;
  const latestKnownEventMs = latestKnownEventAtRaw
    ? Date.parse(latestKnownEventAtRaw)
    : NaN;
  if (latestKnownEventAtRaw && !Number.isFinite(latestKnownEventMs)) {
    // Don't silently swallow garbage — surface it so we notice client bugs
    // instead of mysteriously letting stale items through.
    req.log.warn(
      { latestKnownEventAtRaw },
      "[freshness-floor] received unparseable latestKnownEventAt; floor disabled for this request",
    );
  }
  // STRICT mode: NO slack. The user's directive is "절대" no time regression.
  // If the LLM's `eventHoursAgo` estimate is noisy at the boundary, we'd
  // rather lose one borderline-true item than admit one stale-event item.
  // Equality is allowed (use `>` not `>=`) so that two items collected in
  // the same sweep at the same event time don't filter each other out.
  const maxAllowedEventMinutesAgo = Number.isFinite(latestKnownEventMs)
    ? Math.max(0, Math.floor((Date.now() - latestKnownEventMs) / 60_000))
    : Number.POSITIVE_INFINITY;
  const hasFreshnessFloor = Number.isFinite(maxAllowedEventMinutesAgo);

  const steps: AgentStep[] = [];

  // ============================================================
  // Collector — Perplexity Sonar (real web search via OpenRouter)
  // ============================================================
  const collectorStart = Date.now();
  let candidates: CollectedCandidate[] = [];

  // Always run real web search via the Planner's investigation plan, even for
  // intentType=match. The "match" intent simply means the asker is looking for
  // people/communities — the real-world signals about where those people
  // congregate (dating apps, KSA Reddit/Instagram, niche cafes) are exactly
  // what the user wants to see, NOT a synthetic placeholder. Internal user
  // matching can be re-introduced later behind a feature flag.
  {
    try {
      const queryHints = [
        spec.topic,
        ...spec.entities,
        spec.locationScope ?? "",
      ]
        .filter(Boolean)
        .join(" / ");
      const sourcePref = spec.suggestedSources.join(", ");
      // Re-sniff trends at refresh time too. The 6h in-memory cache means
      // repeated poller sweeps within the same window pay zero cost; only
      // the first refresh after a window boundary actually hits the
      // network. This keeps the strategy in sync with where the topic is
      // ACTUALLY hot RIGHT NOW (not where it was when the interest was
      // first registered, which could be days/weeks ago).
      try {
        const sniffed = await sniffTrends({
          topic: spec.topic,
          entities: spec.entities,
          locationScope: spec.locationScope,
          plannerStrategy: spec.searchStrategy ?? [],
          logger: req.log,
        });
        if (sniffed.reordered.length > 0) {
          spec.searchStrategy = sniffed.reordered;
          if (!sniffed.cached && (sniffed.bumpedChannels.length > 0 || sniffed.addedChannels.length > 0)) {
            steps.push({
              agent: "TrendSniffer",
              status: "success",
              message: `실시간 신호 갱신 · 우선 채널: ${spec.searchStrategy[0]?.channel ?? "n/a"}`,
              durationMs: sniffed.durationMs,
            });
          }
        }
      } catch (err) {
        req.log.warn({ err }, "[trend-sniffer] refresh-time sniff failed (non-fatal)");
      }
      const deadHosts = await getRecentBlacklistedHosts(30);
      const deadHostsLine = deadHosts.length > 0
        ? `\nKNOWN-DEAD HOSTS (avoid items hosted on these domains): ${deadHosts.join(", ")}`
        : "";
      const strategyBlock =
        (spec.searchStrategy?.length ?? 0) > 0
          ? spec.searchStrategy!
              .map(
                (s, i) =>
                  `  ${i + 1}. CHANNEL: ${s.channel}\n     QUERY: ${s.query}\n     WHY: ${s.rationale}`,
              )
              .join("\n")
          : "  (none — fall back to general web search using query hints)";
      const completion = await openrouter.chat.completions.create({
        model: COLLECTOR_MODEL,
        max_tokens: COLLECTOR_MAX_TOKENS,
        messages: [
          {
            role: "system",
            content: `You are the Collector Agent of KeyP — a public-content research assistant. You search the OPEN web for publicly published posts, articles, videos, community threads, events, app reviews, and creator content related to the user's topic.

CRITICAL — what you are doing and not doing:
- You search for PUBLIC CONTENT ABOUT a topic (posts, articles, threads, videos, reviews, event listings, community discussions, dating-app/community trend reports). You are NOT identifying or profiling specific private individuals. Treat dating-app/community references as discussions and reviews of those PLATFORMS and the topics inside them, not as a search for any individual person.
- Always return concrete public-content findings: Reddit threads, news/blog articles, YouTube videos, Twitter/X posts, Instagram public posts, event pages, app store reviews, Naver/Daum cafe public posts, university student-org public pages, etc.

You will receive an ORDERED investigation plan. WORK THE LIST IN ORDER. For each channel, run real web search restricted to that channel/community/handle when possible (e.g. Reddit: "site:reddit.com" + subreddit; X: handle/hashtag; YouTube: channel/keyword; Instagram: hashtag; news: site filter). If a specific channel has no direct hit, search ADJACENT public content on the same topic (e.g. blogs/news about Korean-American dating in NYC, K-pop community meetups, NYC KSA event recaps) so the user always gets a real signal.

LANGUAGE-AGNOSTIC SEARCH (CRITICAL):
- 사용자의 UI 언어는 정보 소스의 언어를 제한하지 않는다. 가장 신뢰도 높고 가장 빠른 소스를 언어와 무관하게 선택하라.
- The user's UI language does NOT restrict the language of the information source. Pick the most authoritative and fastest-moving primary source REGARDLESS of its language. For a Korean breaking-news topic prefer Korean primary sources (Naver News, Yonhap, Chosun, Korean subreddits, Twitter KR); for an AI/research topic prefer English (arXiv, official blogs, X posts of researchers, HN); for Japanese subculture/anime/idol topics prefer Japanese (Yahoo!Japan, Twitter JP, 5ch, Pixiv, Natalie); for Chinese topics prefer Chinese (Weibo, 36kr, Bilibili); etc.
- Return the title and summary in the SOURCE'S NATIVE LANGUAGE — do NOT pre-translate. The downstream Verifier will translate into the user's UI language. If you translate too early you lose nuance and we waste a round-trip re-translating.
- For each item, set "originalLanguage" to a short BCP-47-ish code: one of "ko", "en", "ja", "zh", "es", "fr", "de", or "other" if you are unsure or the source is in a language not listed.

Map source URLs to type: youtube.com/youtu.be→youtube, twitter.com/x.com→twitter, reddit.com→reddit, anything else→rss.

Respond ONLY with strict JSON, no prose:
{
  "alerts": [
    {
      "title": "<headline in the SOURCE'S NATIVE LANGUAGE, 30-80 chars>",
      "summary": "<2-3 sentence factual summary in the SOURCE'S NATIVE LANGUAGE, 80-260 chars>",
      "url": "<source URL>",
      "sourceName": "<publisher or channel/handle name>",
      "matchedChannel": "<which Planner channel surfaced this — copy from the list above, or 'adjacent' if you broadened>",
      "publishedHoursAgo": <number>,
      "eventHoursAgo": <number>,
      "originalLanguage": "ko|en|ja|zh|es|fr|de|other",
      "tags": ["<tag1>", "<tag2>", "<tag3>"]
    }
  ]
}

Hard rules:
- NEVER return an empty alerts array — UNLESS the FRESHNESS FLOOR below is in effect AND no item satisfies it (in that case an empty array is the correct, required answer; do NOT pad with older-event items to avoid empty state). For all other cases: if no exact match exists in the listed channels, broaden to the most relevant adjacent public content on the same topic and return at least 1 real, dated finding with a real URL.
- Each item MUST be real public web content with a real URL — no placeholders, no "I cannot help with that", no apologies.
- **URL INTEGRITY (CRITICAL)**: The "url" field MUST be a URL you actually retrieved from your web search results — copied verbatim from a real search hit. NEVER guess, fabricate, pattern-construct, shorten, or reconstruct URLs from a domain + plausible-looking slug. NEVER invent article IDs, dates in paths, or category segments. If you do not have an exact, working URL from a real search result, OMIT THAT ITEM ENTIRELY and find a different one. Items whose URL returns 404 will be discarded by a downstream reachability check, wasting the user's time — so it is much better to return one item with a verified URL than three items with guessed URLs. Prefer canonical homepage/article URLs over deep-linked search/preview URLs.
- **Content-recency over republish-recency**: if a recently-published page is actually recapping a much older event/news/gossip, set eventHoursAgo to when the EVENT itself occurred (read the body — dates in the article, "X years ago", "in 2024", etc.). Strongly prefer items whose underlying event is genuinely recent over items merely republished today about old stories.
- If the user already received the items listed under EXISTING USER ALERTS below, DO NOT return the same story again, even from a different source/URL — find a different, genuinely new development.
- DO NOT translate. Keep title/summary in the source's native language; the Verifier will handle translation.
- publishedHoursAgo: estimated hours since the page was published. If unknown use 6.
- eventHoursAgo: estimated hours since the underlying event/news actually OCCURRED in the real world. If the article is a same-day report on a same-day event, eventHoursAgo ≈ publishedHoursAgo. If the article republishes/recaps an old story, eventHoursAgo is much larger. If you genuinely can't tell, set eventHoursAgo equal to publishedHoursAgo.
- Tags: salient nouns from the content (Korean preferred).`,
          },
          {
            role: "user",
            content: `Topic: ${spec.topic}
Intent: ${spec.intentType}
Target persona: ${spec.targetPersona ?? "(not specified)"}
Entities: ${spec.entities.join(", ")}
Location: ${spec.locationScope ?? "(no location restriction)"}
Urgency: ${spec.urgency}
User goal: ${spec.desiredOutcome}
General source preference order (fallback only): ${sourcePref}
Generic query hints (fallback only): ${queryHints}${deadHostsLine}

INVESTIGATION PLAN — execute in this order:
${strategyBlock}

EXISTING USER ALERTS (already delivered — do NOT return any of these stories again, even rewritten or from a different source):
${
  knownItems.length === 0
    ? "  (none — this is the first alert for this interest)"
    : knownItems
        .map((k, i) => `  ${i + 1}. ${k.title} — ${k.summary.slice(0, 160)}`)
        .join("\n")
}

${
  hasFreshnessFloor
    ? `🚨 FRESHNESS FLOOR (HARDEST RULE — KeyP's prime directive, OVERRIDES the "never return empty" rule):
The user has ALREADY received an alert for an event that occurred ${maxAllowedEventMinutesAgo} minutes ago. You MUST NOT return ANY item whose underlying event (eventHoursAgo × 60) is OLDER than this — i.e. eventHoursAgo MUST be ≤ ${(maxAllowedEventMinutesAgo / 60).toFixed(2)}. Items that fail this rule are pure information garbage to this user and will be dropped downstream anyway, wasting the entire sweep. If your search surfaces only older-event content, RETURN AN EMPTY ARRAY — silence is strictly better than regressing in time, and an empty array IS the correct answer in that situation (the "never return empty" hard rule does NOT apply when this floor is in effect). Re-search with tighter recency filters (e.g. site:reddit.com new=, twitter "filter:replies" since:, news "past hour", YouTube upload date filter) until you find genuinely newer events, or return []. Do NOT lie about eventHoursAgo to satisfy the never-empty rule — honest empty beats dishonest stale.`
    : "(this is the first alert for this interest — no freshness floor yet)"
}

Return up to ${requested} items, sorted with the most content-recent first (smallest eventHoursAgo first).`,
          },
        ],
      });
      const content = completion.choices[0]?.message?.content ?? "";
      let json: { alerts?: unknown[] } = {};
      try {
        json = extractJsonObject(content) as { alerts?: unknown[] };
      } catch (parseErr) {
        req.log.warn(
          { parseErr, contentPreview: content.slice(0, 800) },
          "Collector JSON parse failed",
        );
      }
      const rawAlerts: unknown[] = Array.isArray(json.alerts) ? json.alerts : [];
      if (rawAlerts.length === 0) {
        req.log.warn(
          { contentPreview: content.slice(0, 1000) },
          "Collector returned 0 alerts",
        );
      }
      candidates = rawAlerts
        .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
        .slice(0, requested)
        .map((a): CollectedCandidate => {
          const url = typeof a.url === "string" ? a.url : undefined;
          const detected: AlertData["source"]["type"] = url
            ? /youtube\.com|youtu\.be/i.test(url)
              ? "youtube"
              : /twitter\.com|x\.com/i.test(url)
              ? "twitter"
              : /reddit\.com/i.test(url)
              ? "reddit"
              : "rss"
            : defaultSourceType(spec);
          const hoursAgo =
            typeof a.publishedHoursAgo === "number"
              ? Math.max(0, a.publishedHoursAgo)
              : 6;
          const eventHoursAgo =
            typeof a.eventHoursAgo === "number"
              ? Math.max(0, a.eventHoursAgo)
              : hoursAgo;
          return {
            title: String(a.title ?? `${spec.topic} 관련 신호`),
            summary: String(a.summary ?? `${spec.topic} 관련 새로운 정보가 감지되었습니다.`),
            sourceType: detected,
            sourceName:
              typeof a.sourceName === "string" && a.sourceName.length > 0
                ? a.sourceName
                : detected,
            url,
            minutesAgo: Math.round(hoursAgo * 60),
            eventMinutesAgo: Math.round(eventHoursAgo * 60),
            tags: Array.isArray(a.tags)
              ? a.tags.slice(0, 4).map(String)
              : spec.entities.slice(0, 3),
            originalLanguage: normalizeLang(a.originalLanguage),
          };
        });
      if (candidates.length === 0) {
        try {
          const knownBlock = knownItems.length
            ? `\n\nALREADY-DELIVERED STORIES (do NOT repeat any of these, even with different wording or a different source URL):\n${knownItems.map((k, i) => `${i + 1}. ${k.title} — ${k.summary}`).join("\n")}`
            : "";
          const backupDeadHosts = await getRecentBlacklistedHosts(30);
          const backupDeadHostsBlock = backupDeadHosts.length > 0
            ? `\n\nKNOWN-DEAD HOSTS (avoid items hosted on these domains): ${backupDeadHosts.join(", ")}`
            : "";
          const freshnessBlock = hasFreshnessFloor
            ? `\n\n🚨 FRESHNESS FLOOR (HARDEST RULE — overrides "never return empty"): The user already received an event from ${maxAllowedEventMinutesAgo} minutes ago. eventHoursAgo MUST be ≤ ${(maxAllowedEventMinutesAgo / 60).toFixed(2)}. Items that fail this rule are dropped downstream — return an EMPTY array rather than regressing in time. Empty IS the correct answer when every available item violates this floor; do not pad with older-event items, do not lie about eventHoursAgo.`
            : "";
          const backupQuery = `Find ${requested} real, recently published public web item(s) (news article, blog post, YouTube video, Reddit thread, X post, or community/event page) about: "${spec.topic}"${spec.locationScope ? ` in ${spec.locationScope}` : ""}. Search GLOBALLY across ALL languages — pick the most authoritative/fastest primary source regardless of source language; do NOT pre-translate. Return strict JSON only: {"alerts":[{"title":"<headline in source's native language>","summary":"<2-3 sentence factual summary in source's native language>","url":"<real URL>","sourceName":"<publisher>","matchedChannel":"backup","publishedHoursAgo":<number>,"eventHoursAgo":<number — hours since the underlying event actually occurred; equals publishedHoursAgo for same-day reporting, much larger for republished/recap content>,"originalLanguage":"<ko|en|ja|zh|es|fr|de|other>","tags":["<tag1>","<tag2>"]}]}. URL INTEGRITY (CRITICAL): The "url" must be a URL you actually retrieved from a real web search result, copied verbatim. NEVER guess, fabricate, pattern-construct, or invent URLs (no made-up article IDs, no plausible-looking slugs, no reconstructed paths). If you do not have a real working URL for an item, OMIT it and pick a different verified item — even if that means returning fewer items. URLs that 404 are dropped downstream, so a single verified URL beats several guessed ones. Prefer canonical, stable URLs (homepage, official article URL) over search-result preview URLs. Never return an empty array (UNLESS the freshness floor below forces it) — if exact match is scarce, return the most relevant adjacent recent public content on the same theme with a verified URL. Strongly prefer items whose underlying event genuinely happened recently over items that merely republish old stories today.${freshnessBlock}${knownBlock}${backupDeadHostsBlock}`;
          const backup = await openrouter.chat.completions.create({
            model: COLLECTOR_MODEL,
            max_tokens: COLLECTOR_MAX_TOKENS,
            messages: [
              { role: "system", content: "You are a public-content web research assistant. You return concrete, real, recently published public web findings (URLs included). You never return an empty result; if the exact topic is scarce, broaden to adjacent public content on the same theme. Output strict JSON only." },
              { role: "user", content: backupQuery },
            ],
          });
          const bcontent = backup.choices[0]?.message?.content ?? "";
          let bjson: { alerts?: unknown[] } = {};
          try { bjson = extractJsonObject(bcontent) as { alerts?: unknown[] }; } catch {}
          const bRaw: unknown[] = Array.isArray(bjson.alerts) ? bjson.alerts : [];
          if (bRaw.length > 0) {
            req.log.info({ recovered: bRaw.length }, "Collector backup pass recovered candidates");
          } else {
            req.log.warn({ contentPreview: bcontent.slice(0, 800) }, "Collector backup pass also returned 0");
          }
          candidates = bRaw
            .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
            .slice(0, requested)
            .map((a): CollectedCandidate => {
              const url = typeof a.url === "string" ? a.url : undefined;
              const detected: AlertData["source"]["type"] = url
                ? /youtube\.com|youtu\.be/i.test(url) ? "youtube"
                : /twitter\.com|x\.com/i.test(url) ? "twitter"
                : /reddit\.com/i.test(url) ? "reddit"
                : "rss"
                : defaultSourceType(spec);
              const hoursAgo = typeof a.publishedHoursAgo === "number" ? Math.max(0, a.publishedHoursAgo) : 6;
              const eventHoursAgo = typeof a.eventHoursAgo === "number" ? Math.max(0, a.eventHoursAgo) : hoursAgo;
              return {
                title: String(a.title ?? `${spec.topic} 관련 신호`),
                summary: String(a.summary ?? `${spec.topic} 관련 새로운 정보가 감지되었습니다.`),
                sourceType: detected,
                sourceName: typeof a.sourceName === "string" && a.sourceName.length > 0 ? a.sourceName : detected,
                url,
                minutesAgo: Math.round(hoursAgo * 60),
                eventMinutesAgo: Math.round(eventHoursAgo * 60),
                tags: Array.isArray(a.tags) ? a.tags.slice(0, 4).map(String) : spec.entities.slice(0, 3),
                originalLanguage: normalizeLang(a.originalLanguage),
              };
            });
        } catch (backupErr) {
          req.log.error({ backupErr }, "Collector backup pass failed");
        }
      }
      steps.push({
        agent: "Collector",
        status: candidates.length > 0 ? "success" : "partial",
        message:
          candidates.length > 0
            ? `웹검색에서 ${candidates.length}개 신호 수집 (Perplexity Sonar)`
            : "Perplexity 응답에서 유효한 신호를 추출하지 못함",
        durationMs: Date.now() - collectorStart,
      });
    } catch (err) {
      req.log.error({ err }, "Collector agent (Perplexity) failed");
      steps.push({
        agent: "Collector",
        status: "failed",
        message: "Perplexity 호출 실패 — 빈 결과 반환",
        durationMs: Date.now() - collectorStart,
      });
    }
  }

  // ============================================================
  // URL reachability gate — runs BEFORE Verifier so we don't waste
  // Claude tokens scoring fabricated URLs, and so the user never sees
  // a 404 link. Applies to BOTH Collector and backup-collector outputs.
  // If everything fails the check, candidates becomes empty and the
  // pipeline returns no alerts for this sweep — the poller will retry
  // next tick (better silence than dead links per user request).
  // ============================================================
  if (candidates.length > 0) {
    const beforeUrlGate = candidates.length;
    candidates = await pruneUnreachableCandidates(candidates, req.log, deviceId);
    if (candidates.length !== beforeUrlGate) {
      steps.push({
        agent: "Collector",
        status: candidates.length > 0 ? "partial" : "failed",
        message:
          candidates.length > 0
            ? `출처 검증: ${beforeUrlGate}건 중 ${candidates.length}건만 링크가 살아있음`
            : `출처 검증: ${beforeUrlGate}건 모두 링크가 죽어있어 폐기 (다음 sweep 재시도)`,
        durationMs: 0,
      });
    }
  }

  // ─── Freshness floor enforcement (server-side, post-Collector) ────────
  // Drop any candidate whose underlying event is older than the floor BEFORE
  // we spend Verifier tokens on it. This is the second of three defenses
  // (prompt → server filter → final-stage filter → client filter).
  if (hasFreshnessFloor && candidates.length > 0) {
    const beforeFresh = candidates.length;
    const dropped: { title: string; eventMinutesAgo: number }[] = [];
    candidates = candidates.filter((c) => {
      if (c.eventMinutesAgo > maxAllowedEventMinutesAgo) {
        dropped.push({ title: c.title, eventMinutesAgo: c.eventMinutesAgo });
        return false;
      }
      return true;
    });
    if (dropped.length > 0) {
      req.log.info(
        {
          floor: maxAllowedEventMinutesAgo,
          dropped: dropped.length,
          remaining: candidates.length,
          examples: dropped.slice(0, 3),
        },
        "[freshness-floor] dropped older-event candidates pre-Verifier",
      );
      steps.push({
        agent: "Collector",
        status: candidates.length > 0 ? "partial" : "failed",
        message:
          candidates.length > 0
            ? `최신성 게이트: ${beforeFresh}건 중 ${dropped.length}건이 기존 알림보다 과거 이벤트 — 폐기`
            : `최신성 게이트: ${beforeFresh}건 모두 기존 알림보다 과거 이벤트 — 빈 결과 (다음 sweep 재시도)`,
        durationMs: 0,
      });
    }
  }

  // ============================================================
  // Source reputation — load per-host stats (global + per-device) so
  // BOTH the Selector pre-rank and the Verifier prompt can use them.
  // Survives interest deletion: keyed by host, not interestId.
  // ============================================================
  const candidateHosts = candidates
    .map((c) => hostFromUrl(c.url))
    .filter((h): h is string => !!h);
  const reputationByHost: Map<string, ReputationLookup> =
    candidateHosts.length > 0
      ? await getReputationForHosts(candidateHosts, deviceId ?? null)
      : new Map();

  // ============================================================
  // Selector — feedback-driven prefilter (runs AFTER URL gate so we
  // never spend Verifier tokens on items profiling will discard).
  // ============================================================
  let profile: DeviceProfile | null = null;
  if (deviceId) {
    profile = await getProfile(deviceId);
  }
  if (deviceId && profile && candidates.length > 0) {
    // Plan-aware KEEP_N. Free plan + rich profile → aggressive trim.
    const richProfile = profile.eventCount >= 10;
    const aggressive = plan === "free" && richProfile;
    const KEEP_N = aggressive
      ? Math.max(requested + 2, 4)
      : Math.max(requested * 2, 6);
    if (candidates.length > KEEP_N) {
      const selectorStart = Date.now();
      const before = candidates.length;
      const scored = candidates.map((c) => {
        const baseScore = scoreCandidate(profile!, {
          title: c.title,
          summary: c.summary,
          sourceType: c.sourceType,
          sourceName: c.sourceName,
          tags: c.tags,
        });
        const host = hostFromUrl(c.url);
        const repBoost = host ? reputationScore(reputationByHost.get(host)) : 0;
        return { c, score: baseScore + repBoost };
      });
      scored.sort((a, b) => b.score - a.score);
      candidates = scored.slice(0, KEEP_N).map((x) => x.c);
      const after = candidates.length;
      steps.push({
        agent: "Selector",
        status: "success",
        message: `피드백+소스평판 사전 선별 ${before}→${after}건`,
        durationMs: Date.now() - selectorStart,
      });
    }
  }

  // ============================================================
  // Verifier — Claude Sonnet 4.6 (credibility & relevance scoring)
  // ============================================================
  const verifierStart = Date.now();
  let alerts: AlertData[] = [];

  if (candidates.length === 0) {
    steps.push({
      agent: "Verifier",
      status: "partial",
      message: "검증할 신호 없음",
      durationMs: Date.now() - verifierStart,
    });
  } else {
    try {
      const message = await anthropic.messages.create({
        model: VERIFIER_MODEL,
        max_tokens: VERIFIER_MAX_TOKENS,
        system: `You are the Verifier Agent of KeyP. Evaluate each candidate alert for credibility, relevance, content-recency, and SEMANTIC NOVELTY, AND translate the kept items into the user's UI language.

USER UI LANGUAGE: ${userLanguage}

번역 규칙 / TRANSLATION RULES (CRITICAL):
- Translate the final \`title\` and \`summary\` of every kept candidate into \`userLanguage\` (current request: ${userLanguage}).
- 사용자 UI 언어가 ${userLanguage}이면, 통과한 모든 후보의 title과 summary를 ${userLanguage}로 번역해 출력하라.
- PRESERVE proper nouns (people, brands, places, hashtags, handles, product names) in their original form when they are widely recognized. 고유명사(인명, 브랜드, 지명, 해시태그, 핸들)는 원형 그대로 유지.
- Do NOT translate the URL, sourceName, or any code/identifier. URL과 sourceName은 절대 수정/번역하지 말 것.
- Keep the translated summary CONCISE (1-2 sentences in target language). 번역된 summary는 1-2문장으로 간결하게.
- If the source is already in userLanguage, leave title/summary as-is and set "translated": false. Otherwise rewrite them in userLanguage and set "translated": true.
- Always echo back "originalLanguage" — copy the value provided per candidate (one of ko|en|ja|zh|es|fr|de|other). If the candidate doesn't carry one, infer it from the title/summary text and use the same short codes.

SOURCE INTEGRITY:
- The Verifier MUST NOT change \`source.url\` or \`source.name\`. These pass through unchanged from the Collector. (Translation applies ONLY to title and summary.)

For every candidate, output one entry in the same order with:
- confidence: integer 0-100 reflecting (a) source reliability, (b) match to topic/entities, (c) **content-recency** (publishMinutesAgo AND eventMinutesAgo — penalize items where eventMinutesAgo is far larger than publishMinutesAgo, i.e. old-news republished today), (d) match to user persona/goal.
  Penalize generic statements, off-topic items, unverifiable claims, and stale-event republish posts.
  Boost items with specific facts, named sources, recent OCCURRENCE date, and direct topic match.
- reason: one short sentence in ${userLanguage} (≤80 chars) explaining WHY this matches and why it is fresh.
- include: boolean. Set to FALSE for ANY of the following:
  • off-topic / low quality
  • the underlying event is much older than the publish date (republished old news)
  • SEMANTIC DUPLICATE of an existing user alert listed below — same story, even from a different source/URL/wording. KeyP's prime directive is "no duplicate alerts even from different outlets". When in doubt about novelty, set include=false.
  • SEMANTIC DUPLICATE of an EARLIER candidate in this same batch (only the first occurrence may be included).${
            hasFreshnessFloor
              ? `\n  • 🚨 FRESHNESS FLOOR VIOLATION — eventMinutesAgo > ${maxAllowedEventMinutesAgo}. The user already received an alert for a more recent event in this interest, so any candidate whose underlying event is OLDER than that floor MUST be excluded. This is non-negotiable: regressing in time turns the alerts into information garbage. When in doubt about an item's true event time, set include=false.`
              : ""
          }
- title: the (possibly translated) headline in userLanguage, or original if already in userLanguage.
- summary: the (possibly translated) 1-2 sentence summary in userLanguage, or original if already in userLanguage.
- translated: boolean — true if you rewrote title/summary into userLanguage, false if the source was already in userLanguage.
- originalLanguage: short code (ko|en|ja|zh|es|fr|de|other).

Respond ONLY with strict JSON:
{ "verifications": [ { "confidence": <int>, "reason": "<text in ${userLanguage}>", "include": <bool>, "title": "<text in ${userLanguage}>", "summary": "<text in ${userLanguage}>", "translated": <bool>, "originalLanguage": "<ko|en|ja|zh|es|fr|de|other>" } ] }`,
        messages: [
          {
            role: "user",
            content: `Interest spec: ${JSON.stringify(spec)}

EXISTING USER ALERTS (already delivered — any candidate covering the same story/event must be marked include=false, even with different wording or a different source URL):
${
  knownItems.length === 0
    ? "  (none)"
    : knownItems
        .map((k, i) => `  ${i + 1}. ${k.title} — ${k.summary.slice(0, 200)}`)
        .join("\n")
}
${
  profile && !isProfileEmpty(profile)
    ? `\n사용자 선호 신호 (최근, 가중 적용):\n- 좋아한 예시: ${
        profile.recentLikes.length === 0
          ? "(없음)"
          : profile.recentLikes
              .slice(0, 3)
              .map((r) => `${r.title} — ${r.summary.slice(0, 120)}`)
              .join(" | ")
      }\n- 싫어한 예시: ${
        profile.recentDislikes.length === 0
          ? "(없음)"
          : profile.recentDislikes
              .slice(0, 3)
              .map((r) => `${r.title} — ${r.summary.slice(0, 120)}`)
              .join(" | ")
      }\n- 선호 키워드(상위 8): ${topTokens(profile, 8, false).join(", ") || "(없음)"}\n- 비선호 키워드(상위 8): ${topTokens(profile, 8, true).join(", ") || "(없음)"}\n이 신호를 confidence 산정의 가중치로 사용하되, 객관적 신뢰도/관련성/최신성보다 우선해서는 안 된다.\n`
    : ""
}
Candidates (${candidates.length}):
${candidates
  .map((c, i) => {
    const host = hostFromUrl(c.url);
    const rep = host ? formatReputationForPrompt(reputationByHost.get(host)) : "";
    const repLine = rep ? `\n   소스평판(${host}): ${rep}` : "";
    return `${i + 1}. [${c.sourceType}] ${c.title}\n   ${c.summary}\n   url=${c.url ?? "n/a"}, publish=${c.minutesAgo}분 전, event=${c.eventMinutesAgo}분 전${repLine}`;
  })
  .join("\n\n")}

소스평판 활용 지침: 위 "소스평판" 라인은 같은 도메인이 과거 KeyP에서 어떻게 평가받았는지의 누적 통계다.
- like/pass/avgConf가 높으면 confidence를 약간 가산.
- dislike/stale/dup/dead가 높으면 confidence를 감산.
- 단, 이 신호는 보조 가중치일 뿐 — 객관적 신뢰도/관련성/최신성보다 우선해서는 안 된다.
- ⚠️ 절대 이 "소스평판" 메타데이터를 응답 JSON의 title/summary/reason에 그대로 포함시키지 말 것 (의사결정용 내부 신호).

Return exactly ${candidates.length} verifications in the same order.`,
          },
        ],
      });
      const block = message.content[0];
      const text = block && block.type === "text" ? block.text : "";
      const json = extractJsonObject(text) as { verifications?: unknown[] };
      const verifications: unknown[] = Array.isArray(json.verifications)
        ? json.verifications
        : [];
      alerts = candidates
        .map((c, i): AlertData | null => {
          const v =
            typeof verifications[i] === "object" && verifications[i] !== null
              ? (verifications[i] as Record<string, unknown>)
              : {};
          if (v.include === false) return null;
          const confidence = Math.min(
            100,
            Math.max(0, Math.round(Number(v.confidence) || 70)),
          );
          if (confidence < 50) return null;
          const ageMin = effectiveAge(c);
          const freshness: AlertData["freshness"] =
            ageMin < 10
              ? "live"
              : ageMin < 60
              ? "hot"
              : ageMin < 360
              ? "recent"
              : "older";
          const collectorLang = c.originalLanguage ?? "other";
          const verifierLang = normalizeLang(v.originalLanguage);
          const originalLanguage =
            verifierLang !== "other" ? verifierLang : collectorLang;
          const vTranslated =
            typeof v.translated === "boolean" ? v.translated : undefined;
          const title =
            typeof v.title === "string" && v.title.length > 0 ? v.title : c.title;
          const summary =
            typeof v.summary === "string" && v.summary.length > 0
              ? v.summary
              : c.summary;
          // Derive translated when Verifier didn't explicitly emit it: assume
          // translated=true if userLanguage differs from originalLanguage AND
          // Verifier actually returned a different title/summary than the source.
          const translated =
            vTranslated !== undefined
              ? vTranslated
              : originalLanguage !== userLanguage &&
                (title !== c.title || summary !== c.summary);
          return {
            title,
            summary,
            reason:
              typeof v.reason === "string" && v.reason.length > 0
                ? v.reason
                : c.reason ?? `${spec.topic} 관심사 매칭`,
            confidence,
            freshness,
            // Source MUST pass through unchanged — Verifier may not edit url/name.
            source: { type: c.sourceType, name: c.sourceName, url: c.url },
            tags: c.tags,
            minutesAgo: c.minutesAgo,
            eventMinutesAgo: c.eventMinutesAgo,
            originalLanguage,
            translated,
          };
        })
        .filter((a): a is AlertData => a !== null);
      const translatedCount = alerts.filter((a) => a.translated).length;
      const langSet = new Set<string>();
      for (const a of alerts) {
        if (a.originalLanguage) langSet.add(a.originalLanguage);
      }
      req.log.info(
        {
          translated: translatedCount,
          notTranslated: alerts.length - translatedCount,
          userLanguage,
          languages: [...langSet].slice(0, 3),
        },
        "[verifier] translation summary",
      );
      const rejected = candidates
        .map((c, i) => {
          const v =
            typeof verifications[i] === "object" && verifications[i] !== null
              ? (verifications[i] as Record<string, unknown>)
              : {};
          if (v.include === false || (Number(v.confidence) || 70) < 50) {
            return {
              title: c.title.slice(0, 80),
              confidence: Number(v.confidence) || 0,
              reason:
                typeof v.reason === "string"
                  ? v.reason.slice(0, 140)
                  : "(no reason)",
              eventMinutesAgo: c.eventMinutesAgo,
            };
          }
          return null;
        })
        .filter((x) => x !== null);
      if (rejected.length > 0) {
        req.log.warn({ rejected }, "[verifier] rejected candidates");
      }
      // ── Persist per-host reputation from this Verifier pass ──
      // Aggregates: pass/reject counts, classified reject reasons
      // (stale/offTopic/dup), and avg confidence per host. Survives
      // interest deletion. Both global and per-device rows are bumped.
      const repBumps = new Map<
        string,
        {
          verifierPassCount: number;
          verifierRejectCount: number;
          staleRejectCount: number;
          offTopicRejectCount: number;
          dupRejectCount: number;
          confidenceSum: number;
          confidenceCount: number;
        }
      >();
      for (let i = 0; i < candidates.length; i++) {
        const host = hostFromUrl(candidates[i]?.url);
        if (!host) continue;
        const v =
          typeof verifications[i] === "object" && verifications[i] !== null
            ? (verifications[i] as Record<string, unknown>)
            : {};
        const conf = Math.min(100, Math.max(0, Math.round(Number(v.confidence) || 0)));
        const include = v.include !== false && conf >= 50;
        const slot = repBumps.get(host) ?? {
          verifierPassCount: 0,
          verifierRejectCount: 0,
          staleRejectCount: 0,
          offTopicRejectCount: 0,
          dupRejectCount: 0,
          confidenceSum: 0,
          confidenceCount: 0,
        };
        if (conf > 0) {
          slot.confidenceSum += conf;
          slot.confidenceCount += 1;
        }
        if (include) {
          slot.verifierPassCount += 1;
        } else {
          slot.verifierRejectCount += 1;
          const cls = classifyRejectReason(
            typeof v.reason === "string" ? v.reason : null,
          );
          if (cls === "stale") slot.staleRejectCount += 1;
          else if (cls === "offTopic") slot.offTopicRejectCount += 1;
          else if (cls === "dup") slot.dupRejectCount += 1;
        }
        repBumps.set(host, slot);
      }
      for (const [host, delta] of repBumps) {
        void bumpReputation(host, deviceId ?? null, delta);
      }
      steps.push({
        agent: "Verifier",
        status: "success",
        message: `${alerts.length}/${candidates.length}개 신호 통과 (Claude Sonnet 4.6 검증)`,
        durationMs: Date.now() - verifierStart,
      });
    } catch (err) {
      req.log.error({ err }, "Verifier agent (Claude) failed");
      // Fallback: pass candidates through with neutral confidence. We
      // propagate originalLanguage from the Collector when present and set
      // translated=false (no Verifier ⇒ no translation happened). Title/
      // summary remain in source language — acceptable degraded mode.
      alerts = candidates.map((c): AlertData => {
        const ageMin = effectiveAge(c);
        const freshness: AlertData["freshness"] =
          ageMin < 10
            ? "live"
            : ageMin < 60
            ? "hot"
            : ageMin < 360
            ? "recent"
            : "older";
        return {
          title: c.title,
          summary: c.summary,
          reason: c.reason ?? `${spec.topic} 관심사 매칭`,
          confidence: 70,
          freshness,
          source: { type: c.sourceType, name: c.sourceName, url: c.url },
          tags: c.tags,
          minutesAgo: c.minutesAgo,
          eventMinutesAgo: c.eventMinutesAgo,
          originalLanguage: c.originalLanguage ?? "other",
          translated: false,
        };
      });
      steps.push({
        agent: "Verifier",
        status: "partial",
        message: "Claude 호출 실패 — 검증 없이 통과",
        durationMs: Date.now() - verifierStart,
      });
    }
  }

  // ============================================================
  // Deliverer — deterministic ranking
  // ============================================================
  const delivererStart = Date.now();
  alerts.sort((a, b) => {
    // Primary: content-recency (max of publish-age and event-age) — smallest wins.
    // This makes a 3-day-old article about a 1-hour-old event beat a 1-hour-old
    // article that merely recaps year-old news.
    const ageA = Math.max(a.minutesAgo ?? 6 * 60, a.eventMinutesAgo ?? a.minutesAgo ?? 6 * 60);
    const ageB = Math.max(b.minutesAgo ?? 6 * 60, b.eventMinutesAgo ?? b.minutesAgo ?? 6 * 60);
    if (ageA !== ageB) return ageA - ageB;
    return b.confidence - a.confidence;
  });

  // ============================================================
  // FINAL FRESHNESS GATE — KeyP prime directive #2 ("never regress in time")
  // Last line of defense: even if Verifier missed it or the fallback path
  // bypassed earlier filters, drop any alert whose underlying event
  // predates the freshness floor. Better to deliver fewer (or zero) items
  // than information garbage.
  // ============================================================
  if (hasFreshnessFloor && alerts.length > 0) {
    const beforeFinalFresh = alerts.length;
    const droppedFinal: { title: string; eventMinutesAgo: number }[] = [];
    alerts = alerts.filter((a) => {
      const em = a.eventMinutesAgo ?? a.minutesAgo ?? 0;
      if (em > maxAllowedEventMinutesAgo) {
        droppedFinal.push({ title: a.title, eventMinutesAgo: em });
        return false;
      }
      return true;
    });
    if (droppedFinal.length > 0) {
      req.log.info(
        {
          floor: maxAllowedEventMinutesAgo,
          dropped: droppedFinal.length,
          remaining: alerts.length,
          examples: droppedFinal.slice(0, 3),
        },
        "[freshness-floor] FINAL stage dropped stale-event alerts",
      );
      steps.push({
        agent: "Deliverer",
        status: alerts.length > 0 ? "partial" : "failed",
        message: `최신성 최종 게이트: ${beforeFinalFresh}건 중 ${droppedFinal.length}건이 기존 알림보다 과거 — 폐기`,
        durationMs: 0,
      });
    }
  }

  // ============================================================
  // FINAL DEDUP GATE — KeyP prime directive ("never duplicate")
  // Runs AFTER all upstream paths (Verifier success, Verifier-fail fallback,
  // backup-collector). Filters semantic duplicates against known items AND
  // against earlier items in the same response (keep first only).
  // This is intentionally redundant with Verifier prompt rules so that even
  // when an upstream path is bypassed, dedup still holds.
  // ============================================================
  {
    const before = alerts.length;
    const kept: AlertData[] = [];
    for (const a of alerts) {
      const dupOfKnown = isSemanticDupOfAny(
        { title: a.title, summary: a.summary },
        knownItems,
      );
      const dupOfBatch = isSemanticDupOfAny(
        { title: a.title, summary: a.summary },
        kept.map((k) => ({ title: k.title, summary: k.summary })),
      );
      if (!dupOfKnown && !dupOfBatch) kept.push(a);
    }
    alerts = kept;
    if (before !== kept.length) {
      req.log.info(
        { dropped: before - kept.length, kept: kept.length, knownCount: knownItems.length },
        "Final dedup gate dropped semantic duplicates",
      );
    }
  }

  // Seed guarantee: when the caller asked for exactly 1 (initial registration),
  // the user must always see at least one most-recent related signal — never
  // an empty list. If Verifier filtered everything out, rescue the strongest
  // raw candidate with a softened confidence floor — but ONLY among candidates
  // that pass the same dedup gate, so seed rescue can never violate the prime
  // directive by reviving a duplicate of an existing alert.
  if (requested === 1 && alerts.length === 0 && candidates.length > 0) {
    const eligible = candidates.filter(
      (c) =>
        !isSemanticDupOfAny({ title: c.title, summary: c.summary }, knownItems) &&
        // Seed-rescue must also respect the freshness floor — never revive a
        // stale-event candidate just to avoid empty state. Silence wins.
        (!hasFreshnessFloor || c.eventMinutesAgo <= maxAllowedEventMinutesAgo),
    );
    if (eligible.length === 0) {
      steps.push({
        agent: "Deliverer",
        status: "partial",
        message: "모든 후보가 기존 알림과 중복 — 빈 결과 유지 (중복 알림 금지)",
        durationMs: 0,
      });
      // fall through; alerts stays empty
    } else {
    const best = [...eligible].sort((a, b) => effectiveAge(a) - effectiveAge(b))[0]!;
    const ageMin = effectiveAge(best);
    const freshness: AlertData["freshness"] =
      ageMin < 10
        ? "live"
        : ageMin < 60
        ? "hot"
        : ageMin < 360
        ? "recent"
        : "older";
    alerts = [
      {
        title: best.title,
        summary: best.summary,
        reason:
          best.reason ?? `${spec.topic} 관련 가장 최근 신호 (검증 점수 미달, 참고용)`,
        confidence: 55,
        freshness,
        source: { type: best.sourceType, name: best.sourceName, url: best.url },
        tags: best.tags,
        minutesAgo: best.minutesAgo,
        eventMinutesAgo: best.eventMinutesAgo,
        // Verifier never ran — propagate source language as-is, no translation.
        originalLanguage: best.originalLanguage ?? "other",
        translated: false,
      },
    ];
    steps.push({
      agent: "Deliverer",
      status: "partial",
      message: "검증 통과 신호가 없어 가장 최근 후보를 참고용으로 보존",
      durationMs: 0,
    });
    }
  }

  alerts = alerts.slice(0, requested);
  steps.push({
    agent: "Deliverer",
    status: "success",
    message: `신선도·신뢰도 순으로 정렬 완료 (${alerts.length}건)`,
    durationMs: Date.now() - delivererStart + 5,
  });

  const result: GeneratedAlertsResult = { alerts, steps };
  const validation = GenerateAlertsResponse.safeParse(result);
  if (!validation.success) {
    req.log.warn(
      { issues: validation.error.flatten() },
      "Alerts output failed schema validation, returning empty set with failed step",
    );
    const failedResult: GeneratedAlertsResult = {
      alerts: [],
      steps: [
        ...steps,
        {
          agent: "Validator",
          status: "failed",
          message: "응답 형식 불일치 — 빈 결과 반환",
          durationMs: 0,
        },
      ],
    };
    res.json(GenerateAlertsResponse.parse(failedResult));
    return;
  }
  res.json(validation.data);
});

export default router;
