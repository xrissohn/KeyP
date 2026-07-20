import type { InterestPlan, RunRequest, RunResponse } from "../shared/contracts.js";
import { createCandidate, fuseSignals, makeRunId, type JudgeDimension } from "./deterministic.js";

export function fallbackPlan(request: RunRequest): InterestPlan {
  const topic = request.interest.trim();
  const lanes = [
    ["official", "Official desk", `${topic} official announcement primary source`, ["Official sites", "Government", "Research labs"]],
    ["breaking", "Breaking desk", `${topic} latest news today`, ["Global news", "Local news", "Primary reports"]],
    ["social", "Social pulse", `${topic} latest public post discussion`, ["X", "Threads", "Bluesky", "Public Instagram"]],
    ["video", "Video radar", `${topic} latest video livestream`, ["YouTube", "TikTok public", "Reels"]],
    ["community", "Community desk", `${topic} firsthand discussion community`, ["Reddit", "Hacker News", "Public forums"]],
    ["korea", "Korea desk", `${topic} 최신 공식 발표 뉴스 블로그`, ["Naver", "Daum", "YouTube KR", "Korean communities"]],
  ] as const;
  return {
    topic: topic.slice(0, 180),
    objective:
      request.language === "ko"
        ? `${topic}에 관한 새롭고 신뢰할 수 있는 공개 신호를 가장 먼저 포착합니다.`
        : `Detect trustworthy new public signals about ${topic} before they become noise.`,
    entities: [],
    locations: [],
    exclusions: ["private accounts", "stale recaps", "unverified claims"],
    lanes: lanes.map(([lane, label, query, targets]) => ({
      lane,
      label,
      query,
      targets: [...targets],
    })),
  };
}

export function createDemoRun(request: RunRequest): RunResponse {
  const started = Date.now();
  const plan = fallbackPlan(request);
  const now = Date.now();
  const candidates = [
    createCandidate("official", {
      title: "OpenAI publishes current GPT-5.6 model guidance",
      summary:
        "The official model guide documents how to use GPT-5.6, including reasoning controls and recommended migration patterns.",
      url: "https://developers.openai.com/api/docs/guides/latest-model",
      sourceName: "OpenAI Developers",
      sourceType: "official",
      publishedAt: new Date(now - 28 * 60_000).toISOString(),
      eventAt: new Date(now - 28 * 60_000).toISOString(),
      evidence: "Direct first-party documentation closely matches the monitored topic.",
      tags: ["GPT-5.6", "official", "models"],
    }),
    createCandidate("community", {
      title: "Agents SDK orchestration patterns are now documented end-to-end",
      summary:
        "The Agents SDK guide covers specialists, handoffs, guardrails, results, state, and evaluation as one code-first workflow.",
      url: "https://developers.openai.com/api/docs/guides/agents",
      sourceName: "OpenAI Developers",
      sourceType: "official",
      publishedAt: new Date(now - 74 * 60_000).toISOString(),
      eventAt: new Date(now - 74 * 60_000).toISOString(),
      evidence: "The guide is a primary source for the architecture KeyP monitors.",
      tags: ["agents", "orchestration", "SDK"],
    }),
    createCandidate("social", {
      title: "Bluesky public search exposes a fast lane for open social signals",
      summary:
        "Bluesky's public AppView endpoints provide searchable public posts without requiring access to private accounts.",
      url: "https://docs.bsky.app/docs/api/app-bsky-feed-search-posts",
      sourceName: "Bluesky Docs",
      sourceType: "bluesky",
      publishedAt: new Date(now - 132 * 60_000).toISOString(),
      eventAt: new Date(now - 132 * 60_000).toISOString(),
      evidence: "A public, documented social source can complement web search safely.",
      tags: ["bluesky", "public-api", "social"],
    }),
  ];
  const dimensions: JudgeDimension[] = [
    "credibility",
    "relevance",
    "freshness",
    "novelty",
  ];
  const scores = Object.fromEntries(
    dimensions.map((dimension, dimensionIndex) => [
      dimension,
      candidates.map((candidate, index) => ({
        candidateId: candidate.id,
        score: Math.max(58, 94 - index * 6 - dimensionIndex * 2),
        include: true,
        reason: `Demo ${dimension} judge accepted the source.`,
      })),
    ]),
  ) as Parameters<typeof fuseSignals>[0]["scores"];
  const editorial = new Map(
    candidates.map((candidate) => [
      candidate.id,
      {
        title: candidate.title,
        summary: candidate.summary,
        whyItMatters:
          request.language === "ko"
            ? "검증 가능한 1차 출처에서 확인된 신호이며 KeyP의 관심사와 직접 연결됩니다."
            : "A verifiable primary-source signal directly connected to this KeyP interest.",
      },
    ]),
  );
  const signals = fuseSignals({ candidates, scores, request, editorial });
  const events = [
    { id: "manager", name: "Intent Architect", role: "manager" as const, status: "success" as const, detail: "Structured the interest into six search lanes", durationMs: 420 },
    ...plan.lanes.map((lane, index) => ({ id: `scout-${lane.lane}`, name: lane.label, role: "scout" as const, lane: lane.lane, status: "success" as const, detail: index < 3 ? "Found a high-signal source" : "Completed without fabrication", durationMs: 680 + index * 95 })),
    { id: "gate", name: "Evidence gate", role: "gate" as const, status: "success" as const, detail: "URLs, freshness, and duplicates verified", durationMs: 188 },
    ...dimensions.map((dimension, index) => ({ id: `judge-${dimension}`, name: `${dimension[0].toUpperCase()}${dimension.slice(1)} Judge`, role: "judge" as const, status: "success" as const, detail: "Scored candidates independently", durationMs: 350 + index * 55 })),
    { id: "editor", name: "Briefing Editor", role: "editor" as const, status: "success" as const, detail: "Preserved sources and prepared the briefing", durationMs: 390 },
  ];
  const sequential = events.reduce((total, event) => total + event.durationMs, 0);
  const wallClockMs = Math.max(1, Date.now() - started + 1_880);
  return {
    runId: makeRunId(),
    mode: "demo",
    model: "gpt-5.6 · demo fixture",
    generatedAt: new Date().toISOString(),
    headline:
      request.language === "ko"
        ? "지금 알아야 할 가장 강한 신호 3개"
        : "Three strong signals worth knowing now",
    briefing:
      request.language === "ko"
        ? "12개의 전문 에이전트가 관심사를 분해하고 출처·신선도·관련성을 교차 검증한 데모 결과입니다."
        : "A demo run showing how 12 specialists decompose, search, and cross-check one interest.",
    plan,
    signals,
    events,
    metrics: {
      laneCount: 6,
      candidateCount: candidates.length + 9,
      verifiedCount: candidates.length,
      selectedCount: signals.length,
      sourceCoverage: [...new Set(signals.map((signal) => signal.sourceType))],
      wallClockMs,
      estimatedSequentialMs: sequential,
      parallelSpeedup: Number((sequential / wallClockMs).toFixed(1)),
    },
  };
}
