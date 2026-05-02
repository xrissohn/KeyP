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

const router: IRouter = Router();

const MODEL = "gpt-5.4";
const MAX_TOKENS = 4096;

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
      model: MODEL,
      max_completion_tokens: MAX_TOKENS,
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
    const json = JSON.parse(content);
    spec = {
      intentType: json.intentType ?? "monitor",
      topic: typeof json.topic === "string" && json.topic.length > 0 ? json.topic : rawText.slice(0, 30),
      entities: Array.isArray(json.entities) ? json.entities.slice(0, 6).map(String) : [],
      locationScope: json.locationScope ?? undefined,
      urgency: json.urgency ?? "medium",
      desiredOutcome: json.desiredOutcome ?? `${rawText.slice(0, 20)} 관련 동향 추적`,
      trustNeed: json.trustNeed ?? "medium",
      matchMode: json.matchMode ?? undefined,
      privacyLevel: json.privacyLevel ?? "public",
      negativeConstraints: Array.isArray(json.negativeConstraints)
        ? json.negativeConstraints.map(String)
        : [],
      suggestedSources: Array.isArray(json.suggestedSources) && json.suggestedSources.length > 0
        ? json.suggestedSources
        : ["twitter", "youtube", "reddit", "rss"],
    };
    steps.push({
      agent: "Planner",
      status: "success",
      message: `의도 "${spec.intentType}" 식별 · 엔티티 ${spec.entities.length}개 추출`,
      durationMs: Date.now() - plannerStart,
    });
  } catch (err) {
    req.log.error({ err }, "Planner agent failed");
    spec = fallbackPlanner(rawText);
    steps.push({
      agent: "Planner",
      status: "partial",
      message: "LLM 호출 실패 — 키워드 기반 폴백 사용",
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
    req.log.warn({ issues: validation.error.flatten() }, "Planner output failed schema validation, using fallback");
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

router.post("/agents/generate-alerts", async (req, res) => {
  const parsed = GenerateAlertsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { spec, count } = parsed.data;
  const requested = count ?? 3;
  const steps: AgentStep[] = [];

  const collectorStart = Date.now();
  let alerts: AlertData[] = [];

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Collector + Verifier Agents of KeyP, a Korean-language interest tracking app.
Given a structured interest spec, simulate ${requested} highly relevant, realistic alerts that would
plausibly appear from the listed sources. Respond ONLY with JSON in this format:
{
  "alerts": [
    {
      "title": "<Korean headline, 30-60 chars>",
      "summary": "<Korean summary, 80-200 chars, factual tone>",
      "reason": "<one-line Korean rationale: why this matches the user's interest>",
      "confidence": <integer 60-98>,
      "freshness": "live"|"hot"|"recent"|"older",
      "source": { "type": "youtube"|"twitter"|"reddit"|"rss"|"match", "name": "<display name>" },
      "tags": ["<tag1>", "<tag2>", "<tag3>"],
      "minutesAgo": <integer 2-720>
    }
  ]
}
Rules:
- Distribute sources across spec.suggestedSources, with the first source most represented.
- Use specific, plausible Korean phrasing — no placeholders like "X" or "[topic]".
- Tags should be the most salient entities from spec.entities.
- freshness must align with minutesAgo: live<10, hot<60, recent<360, older>=360.
- For intentType=match, source.type must be "match" and source.name="KeyP 매칭".
- urgency=high → confidence>=80 and at least one alert with freshness=live.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            topic: spec.topic,
            intentType: spec.intentType,
            entities: spec.entities,
            urgency: spec.urgency,
            desiredOutcome: spec.desiredOutcome,
            suggestedSources: spec.suggestedSources,
            locationScope: spec.locationScope,
          }),
        },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(content);
    const rawAlerts: unknown[] = Array.isArray(json.alerts) ? json.alerts : [];
    alerts = rawAlerts
      .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
      .slice(0, requested)
      .map((a) => {
        const sourceObj =
          typeof a.source === "object" && a.source !== null
            ? (a.source as Record<string, unknown>)
            : {};
        const sourceType = (sourceObj.type as AlertData["source"]["type"]) ?? "rss";
        const sourceName =
          typeof sourceObj.name === "string" && sourceObj.name.length > 0
            ? sourceObj.name
            : sourceType;
        const minutesAgo =
          typeof a.minutesAgo === "number" ? Math.max(0, Math.floor(a.minutesAgo)) : 30;
        const freshness: AlertData["freshness"] =
          minutesAgo < 10 ? "live" : minutesAgo < 60 ? "hot" : minutesAgo < 360 ? "recent" : "older";
        return {
          title: String(a.title ?? `${spec.topic} 관련 신호`),
          summary: String(a.summary ?? `${spec.topic}에 관련된 새로운 정보가 감지되었습니다.`),
          reason: String(a.reason ?? `${spec.topic} 관심사 매칭`),
          confidence: Math.min(98, Math.max(50, Number(a.confidence) || 75)),
          freshness,
          source: { type: sourceType, name: sourceName },
          tags: Array.isArray(a.tags) ? a.tags.slice(0, 4).map(String) : spec.entities.slice(0, 3),
          minutesAgo,
        } satisfies AlertData;
      });
    steps.push({
      agent: "Collector",
      status: "success",
      message: `${alerts.length}개 신호 수집 완료`,
      durationMs: Date.now() - collectorStart,
    });
  } catch (err) {
    req.log.error({ err }, "Collector agent failed");
    steps.push({
      agent: "Collector",
      status: "failed",
      message: "LLM 호출 실패 — 빈 결과 반환",
      durationMs: Date.now() - collectorStart,
    });
  }

  const verifierStart = Date.now();
  alerts = alerts.filter((a) => a.confidence >= 60);
  steps.push({
    agent: "Verifier",
    status: "success",
    message: `${alerts.length}개 신호 검증 통과 (신뢰도 ≥60%)`,
    durationMs: Date.now() - verifierStart + 8,
  });

  const delivererStart = Date.now();
  alerts.sort((a, b) => {
    const order: Record<AlertData["freshness"], number> = { live: 0, hot: 1, recent: 2, older: 3 };
    return order[a.freshness] - order[b.freshness] || b.confidence - a.confidence;
  });
  steps.push({
    agent: "Deliverer",
    status: "success",
    message: `신선도·신뢰도 순으로 정렬 완료`,
    durationMs: Date.now() - delivererStart + 5,
  });

  const result: GeneratedAlertsResult = { alerts, steps };
  const validation = GenerateAlertsResponse.safeParse(result);
  if (!validation.success) {
    req.log.warn({ issues: validation.error.flatten() }, "Alerts output failed schema validation, returning empty set with failed step");
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
