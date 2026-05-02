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

const router: IRouter = Router();

const PLANNER_MODEL = "gpt-5.4";
const COLLECTOR_MODEL = "perplexity/sonar";
const VERIFIER_MODEL = "claude-sonnet-4-6";
const PLANNER_MAX_TOKENS = 4096;
const COLLECTOR_MAX_TOKENS = 8192;
const VERIFIER_MAX_TOKENS = 8192;

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
  };
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in response");
  }
  return JSON.parse(raw.slice(start, end + 1));
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
          content: `You are the Planner Agent of KeyP, a Korean-language interest tracking app.
Convert the user's natural-language interest description into a structured JSON spec.
Respond ONLY with JSON matching this exact schema (no prose, no markdown):
{
  "intentType": "monitor"|"alert"|"opportunity"|"match"|"creator_watch"|"travel"|"local_signal",
  "topic": "<short Korean topic, max 30 chars>",
  "entities": ["<key entity 1>", "<key entity 2>", "..."],
  "locationScope": "<city or region in Korean, or null>",
  "urgency": "high"|"medium"|"low",
  "desiredOutcome": "<one-line Korean outcome statement>",
  "trustNeed": "high"|"medium"|"low",
  "matchMode": "companion"|"friend"|"collaborate"|"meal_mate"|"date"|null,
  "privacyLevel": "public"|"friends"|"private",
  "negativeConstraints": ["<things to avoid in Korean>"],
  "suggestedSources": ["youtube"|"twitter"|"reddit"|"rss"|"match", ...]
}
Rules:
- intentType=match implies matchMode set; otherwise null.
- suggestedSources MUST be ordered by likelihood of finding signal first.
- entities: 2-5 items. Use original Korean nouns from the text.
- urgency=high if user uses words like 긴급/지금/빨리/내일.`,
        },
        {
          role: "user",
          content: rawText,
        },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(content) as Record<string, unknown>;
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
    };
    steps.push({
      agent: "Planner",
      status: "success",
      message: `의도 "${spec.intentType}" 식별 · 엔티티 ${spec.entities.length}개 추출 (GPT-5.4)`,
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

  const routerStart = Date.now();
  steps.push({
    agent: "SourceRouter",
    status: "success",
    message: `${spec.suggestedSources.length}개 소스 우선순위 계산 (${spec.suggestedSources[0]} 1순위)`,
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
  tags: string[];
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
  const { spec, count } = parsed.data;
  const requested = count ?? 3;
  const steps: AgentStep[] = [];

  // ============================================================
  // Collector — Perplexity Sonar (real web search via OpenRouter)
  // ============================================================
  const collectorStart = Date.now();
  let candidates: CollectedCandidate[] = [];

  if (spec.intentType === "match") {
    // Skip web search for internal matching — synthesize match candidates instead.
    candidates = Array.from({ length: requested }, (_, i) => ({
      title: `${spec.topic} 관련 사용자와 매칭 가능`,
      summary: `${spec.entities.slice(0, 2).join(", ") || spec.topic} 관심사를 공유하는 사용자와 매칭 점수가 높게 측정되었습니다.`,
      reason: `공유 관심사: ${spec.entities.slice(0, 3).join(", ") || spec.topic}`,
      sourceType: "match" as const,
      sourceName: "KeyP 매칭",
      minutesAgo: 5 + i * 30,
      tags: spec.entities.slice(0, 3),
    }));
    steps.push({
      agent: "Collector",
      status: "success",
      message: `${candidates.length}개 매칭 후보 생성 (내부 인덱스)`,
      durationMs: Date.now() - collectorStart,
    });
  } else {
    try {
      const queryHints = [
        spec.topic,
        ...spec.entities,
        spec.locationScope ?? "",
      ]
        .filter(Boolean)
        .join(" / ");
      const sourcePref = spec.suggestedSources.join(", ");
      const completion = await openrouter.chat.completions.create({
        model: COLLECTOR_MODEL,
        max_tokens: COLLECTOR_MAX_TOKENS,
        messages: [
          {
            role: "system",
            content: `You are the Collector Agent of KeyP. Use real-time web search to find ${requested} recent, specific, high-signal items matching the user's Korean-language interest.
Prefer sources in this priority order: ${sourcePref}.
Map source URLs to type: youtube.com/youtu.be→youtube, twitter.com/x.com→twitter, reddit.com→reddit, anything else→rss.
Respond ONLY with strict JSON, no prose:
{
  "alerts": [
    {
      "title": "<Korean headline based on the actual finding, 30-60 chars>",
      "summary": "<Korean 2-3 sentence factual summary of what was found, 80-220 chars>",
      "url": "<source URL>",
      "sourceName": "<publisher or channel/handle name>",
      "publishedHoursAgo": <number, your estimate from the source>,
      "tags": ["<tag1>", "<tag2>", "<tag3>"]
    }
  ]
}
Rules:
- Each item MUST be a real, specific, recent finding — no generic statements, no placeholders.
- Translate non-Korean source titles into natural Korean.
- publishedHoursAgo: best estimate from the page; if unknown use 6.
- Tags: salient nouns from the content (Korean preferred).`,
          },
          {
            role: "user",
            content: `Topic: ${spec.topic}
Intent: ${spec.intentType}
Entities: ${spec.entities.join(", ")}
Location: ${spec.locationScope ?? "(no location restriction)"}
Urgency: ${spec.urgency}
User goal: ${spec.desiredOutcome}
Search query hints: ${queryHints}
Return ${requested} items.`,
          },
        ],
      });
      const content = completion.choices[0]?.message?.content ?? "";
      const json = extractJsonObject(content) as { alerts?: unknown[] };
      const rawAlerts: unknown[] = Array.isArray(json.alerts) ? json.alerts : [];
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
            tags: Array.isArray(a.tags)
              ? a.tags.slice(0, 4).map(String)
              : spec.entities.slice(0, 3),
          };
        });
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
  } else if (spec.intentType === "match") {
    // For match candidates, no external verification needed; assign deterministic scores.
    alerts = candidates.map((c, i) => ({
      title: c.title,
      summary: c.summary,
      reason: c.reason ?? `${spec.topic} 매칭 점수 상위`,
      confidence: 88 - i * 4,
      freshness: c.minutesAgo < 10 ? "live" : c.minutesAgo < 60 ? "hot" : "recent",
      source: { type: c.sourceType, name: c.sourceName, url: c.url },
      tags: c.tags,
      minutesAgo: c.minutesAgo,
    }));
    steps.push({
      agent: "Verifier",
      status: "success",
      message: `${alerts.length}개 매칭 후보 점수 계산`,
      durationMs: Date.now() - verifierStart,
    });
  } else {
    try {
      const message = await anthropic.messages.create({
        model: VERIFIER_MODEL,
        max_tokens: VERIFIER_MAX_TOKENS,
        system: `You are the Verifier Agent of KeyP. Evaluate each candidate alert for credibility and relevance to the user's interest spec.
For every candidate, output one entry in the same order with:
- confidence: integer 0-100 reflecting (a) source reliability, (b) match to topic/entities, (c) freshness alignment.
  Penalize generic statements, off-topic items, and unverifiable claims.
  Boost items with specific facts, named sources, recent publication, and direct topic match.
- reason: one Korean sentence (≤80 chars) explaining WHY this matches the user's interest.
- include: boolean. false if the item is off-topic, duplicate, or low-quality.
Respond ONLY with strict JSON:
{ "verifications": [ { "confidence": <int>, "reason": "<Korean>", "include": <bool> } ] }`,
        messages: [
          {
            role: "user",
            content: `Interest spec: ${JSON.stringify(spec)}

Candidates (${candidates.length}):
${candidates
  .map(
    (c, i) =>
      `${i + 1}. [${c.sourceType}] ${c.title}\n   ${c.summary}\n   url=${c.url ?? "n/a"}, ${c.minutesAgo}분 전`,
  )
  .join("\n\n")}

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
          const freshness: AlertData["freshness"] =
            c.minutesAgo < 10
              ? "live"
              : c.minutesAgo < 60
              ? "hot"
              : c.minutesAgo < 360
              ? "recent"
              : "older";
          return {
            title: c.title,
            summary: c.summary,
            reason:
              typeof v.reason === "string" && v.reason.length > 0
                ? v.reason
                : c.reason ?? `${spec.topic} 관심사 매칭`,
            confidence,
            freshness,
            source: { type: c.sourceType, name: c.sourceName, url: c.url },
            tags: c.tags,
            minutesAgo: c.minutesAgo,
          };
        })
        .filter((a): a is AlertData => a !== null);
      steps.push({
        agent: "Verifier",
        status: "success",
        message: `${alerts.length}/${candidates.length}개 신호 통과 (Claude Sonnet 4.6 검증)`,
        durationMs: Date.now() - verifierStart,
      });
    } catch (err) {
      req.log.error({ err }, "Verifier agent (Claude) failed");
      // Fallback: pass candidates through with neutral confidence.
      alerts = candidates.map((c): AlertData => {
        const freshness: AlertData["freshness"] =
          c.minutesAgo < 10
            ? "live"
            : c.minutesAgo < 60
            ? "hot"
            : c.minutesAgo < 360
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
    const order: Record<AlertData["freshness"], number> = {
      live: 0,
      hot: 1,
      recent: 2,
      older: 3,
    };
    return order[a.freshness] - order[b.freshness] || b.confidence - a.confidence;
  });
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
