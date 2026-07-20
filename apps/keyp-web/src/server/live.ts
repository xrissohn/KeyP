import {
  Agent,
  run,
  setDefaultOpenAIKey,
  setTracingDisabled,
  webSearchTool,
} from "@openai/agents";
import type {
  AgentEvent,
  Candidate,
  InterestPlan,
  JudgeScore,
  Lane,
  RunRequest,
  RunResponse,
} from "../shared/contracts.js";
import {
  editorialOutputSchema,
  interestPlanSchema,
  judgeOutputSchema,
  scoutOutputSchema,
} from "../shared/contracts.js";
import {
  candidateId,
  canonicalUrl,
  dedupeCandidates,
  detectSourceType,
  deterministicDimensionScore,
  fuseSignals,
  isFresh,
  makeRunId,
  sourceNameFromUrl,
  type JudgeDimension,
} from "./deterministic.js";
import { fallbackPlan } from "./demo.js";
import { collectPublicAdapters } from "./publicAdapters.js";
import { probePublicUrl } from "./urlSafety.js";

const DIMENSIONS: JudgeDimension[] = [
  "credibility",
  "relevance",
  "freshness",
  "novelty",
];

const LANE_RULES: Record<Lane, string> = {
  official:
    "Search first-party organizations, government releases, company or research blogs, official changelogs, and primary announcements.",
  breaking:
    "Search current reputable reporting and the primary source closest to the underlying event. Reject fresh articles that merely recap an old event.",
  social:
    "Search public, indexed posts on X, Threads, Bluesky, Mastodon, public Facebook pages, and public Instagram captions. Never access private profiles.",
  video:
    "Search recent public YouTube videos, creator posts, livestream schedules, public TikTok pages, and public Reels pages.",
  community:
    "Search Reddit, Hacker News, public forums, and web-visible specialist communities for firsthand or expert signals.",
  korea:
    "Search Korean primary sources, Naver News, Naver Blog, public Naver pages, Daum, Korean communities, YouTube KR, and public Korean social posts.",
};

function modelName(): string {
  return process.env.KEYP_MODEL?.trim() || "gpt-5.6";
}

function requireRuntime(): { model: string; key: string } {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const model = modelName();
  setDefaultOpenAIKey(key);
  setTracingDisabled(process.env.KEYP_TRACING_ENABLED !== "true");
  return { model, key };
}

function normalizePlan(plan: InterestPlan, fallback: InterestPlan): InterestPlan {
  const byLane = new Map(plan.lanes.map((lane) => [lane.lane, lane]));
  return {
    ...plan,
    lanes: fallback.lanes.map((lane) => byLane.get(lane.lane) ?? lane),
  };
}

async function runPlanner(
  request: RunRequest,
  model: string,
): Promise<{ plan: InterestPlan; event: AgentEvent }> {
  const started = Date.now();
  const fallback = fallbackPlan(request);
  const agent = new Agent({
    name: "KeyP Intent Architect",
    model,
    outputType: interestPlanSchema,
    instructions: `You are KeyP's manager. Turn one natural-language interest into a precise public-information monitoring plan.

Create exactly one task for each lane: official, breaking, social, video, community, korea. Each lane gets one high-precision multilingual query and named public source targets. Preserve the user's real objective, entities, locations, and exclusions. Do not infer sensitive traits or identify private people. The requested freshness window is a hard product limit.`,
  });
  try {
    const result = await run(
      agent,
      JSON.stringify({
        interest: request.interest,
        language: request.language,
        freshnessHours: request.freshnessHours,
      }),
      { maxTurns: 2 },
    );
    const plan = normalizePlan(interestPlanSchema.parse(result.finalOutput), fallback);
    return {
      plan,
      event: {
        id: "manager",
        name: "Intent Architect",
        role: "manager",
        status: "success",
        detail: "Structured the interest into six bounded search lanes",
        durationMs: Date.now() - started,
      },
    };
  } catch (error) {
    return {
      plan: fallback,
      event: {
        id: "manager",
        name: "Intent Architect",
        role: "manager",
        status: "partial",
        detail: `Used deterministic plan: ${error instanceof Error ? error.message : "planner unavailable"}`,
        durationMs: Date.now() - started,
      },
    };
  }
}

async function runScout(input: {
  lane: InterestPlan["lanes"][number];
  request: RunRequest;
  plan: InterestPlan;
  model: string;
}): Promise<{ candidates: Candidate[]; event: AgentEvent }> {
  const { lane, request, plan, model } = input;
  const started = Date.now();
  const agent = new Agent({
    name: `KeyP ${lane.label}`,
    model,
    tools: [
      webSearchTool({
        searchContextSize: "medium",
        externalWebAccess: true,
      }),
    ],
    outputType: scoutOutputSchema,
    instructions: `You are the ${lane.lane.toUpperCase()} Signal Scout, one narrow specialist in a parallel swarm.

${LANE_RULES[lane.lane]}

Search the live public web before answering. Copy exact URLs from actual results; never construct or guess a URL. Prefer the underlying event time over the page's publish time. Return no signals when evidence is stale, private, inaccessible, repeated, or weak. Never bypass authentication, rate limits, or private-account controls. Keep evidence factual and concise.`,
  });
  try {
    const result = await run(
      agent,
      JSON.stringify({
        monitoringObjective: plan.objective,
        lane,
        freshnessHours: request.freshnessHours,
        outputLanguage: request.language,
        exclusions: plan.exclusions,
        alreadyDeliveredUrls: request.knownUrls,
      }),
      { maxTurns: 6 },
    );
    const output = scoutOutputSchema.parse(result.finalOutput);
    const candidates = output.signals.map((signal) => ({
      ...signal,
      id: candidateId(signal.url, signal.title),
      lane: lane.lane,
      url: canonicalUrl(signal.url),
      sourceName: signal.sourceName || sourceNameFromUrl(signal.url),
      sourceType: detectSourceType(signal.url) === "web" ? signal.sourceType : detectSourceType(signal.url),
    }));
    return {
      candidates,
      event: {
        id: `scout-${lane.lane}`,
        name: lane.label,
        role: "scout",
        lane: lane.lane,
        status: "success",
        detail:
          candidates.length > 0
            ? `Found ${candidates.length} candidate signals`
            : "Completed without inventing a result",
        durationMs: Date.now() - started,
      },
    };
  } catch (error) {
    return {
      candidates: [],
      event: {
        id: `scout-${lane.lane}`,
        name: lane.label,
        role: "scout",
        lane: lane.lane,
        status: "failed",
        detail: error instanceof Error ? error.message : "Scout failed",
        durationMs: Date.now() - started,
      },
    };
  }
}

async function runJudge(input: {
  dimension: JudgeDimension;
  candidates: Candidate[];
  request: RunRequest;
  plan: InterestPlan;
  model: string;
}): Promise<{ scores: JudgeScore[]; event: AgentEvent }> {
  const { dimension, candidates, request, plan, model } = input;
  const started = Date.now();
  if (candidates.length === 0) {
    return {
      scores: [],
      event: {
        id: `judge-${dimension}`,
        name: `${dimension[0].toUpperCase()}${dimension.slice(1)} Judge`,
        role: "judge",
        status: "success",
        detail: "No verified candidates required scoring",
        durationMs: 0,
      },
    };
  }
  const focus: Record<JudgeDimension, string> = {
    credibility:
      "Evaluate source authority, first-party proximity, corroboration, and whether the evidence supports the claim.",
    relevance:
      "Evaluate only how directly the candidate serves the user's monitoring objective and named entities.",
    freshness:
      "Evaluate the underlying event time, not just page publication time, against the hard freshness window.",
    novelty:
      "Evaluate whether this is a distinct development rather than a duplicate, generic explainer, or recycled claim.",
  };
  const agent = new Agent({
    name: `KeyP ${dimension} Judge`,
    model,
    outputType: judgeOutputSchema,
    instructions: `You are an independent ${dimension} judge. ${focus[dimension]}

Score each candidate from 0 to 100, set include=false for a hard failure in this dimension, and give one concise reason. Judge only this dimension; do not rewrite content and do not alter IDs.`,
  });
  try {
    const result = await run(
      agent,
      JSON.stringify({
        objective: plan.objective,
        interest: request.interest,
        freshnessHours: request.freshnessHours,
        candidates: candidates.map((candidate) => ({
          candidateId: candidate.id,
          title: candidate.title,
          summary: candidate.summary,
          sourceName: candidate.sourceName,
          sourceType: candidate.sourceType,
          publishedAt: candidate.publishedAt,
          eventAt: candidate.eventAt,
          evidence: candidate.evidence,
        })),
      }),
      { maxTurns: 2 },
    );
    const parsed = judgeOutputSchema.parse(result.finalOutput);
    const received = new Map(parsed.scores.map((score) => [score.candidateId, score]));
    const scores = candidates.map(
      (candidate): JudgeScore =>
        received.get(candidate.id) ?? {
          candidateId: candidate.id,
          score: deterministicDimensionScore(dimension, candidate, request),
          include: true,
          reason: "Deterministic fallback for a missing judge item.",
        },
    );
    return {
      scores,
      event: {
        id: `judge-${dimension}`,
        name: `${dimension[0].toUpperCase()}${dimension.slice(1)} Judge`,
        role: "judge",
        status: "success",
        detail: `Independently scored ${scores.length} candidates`,
        durationMs: Date.now() - started,
      },
    };
  } catch (error) {
    const scores = candidates.map(
      (candidate): JudgeScore => ({
        candidateId: candidate.id,
        score: deterministicDimensionScore(dimension, candidate, request),
        include: true,
        reason: "Deterministic judge fallback.",
      }),
    );
    return {
      scores,
      event: {
        id: `judge-${dimension}`,
        name: `${dimension[0].toUpperCase()}${dimension.slice(1)} Judge`,
        role: "judge",
        status: "partial",
        detail: error instanceof Error ? error.message : "Judge fallback",
        durationMs: Date.now() - started,
      },
    };
  }
}

async function runEditor(input: {
  candidates: Candidate[];
  request: RunRequest;
  plan: InterestPlan;
  model: string;
}): Promise<{
  headline: string;
  briefing: string;
  editorial: Map<string, { title: string; summary: string; whyItMatters: string }>;
  event: AgentEvent;
}> {
  const { candidates, request, plan, model } = input;
  const started = Date.now();
  const agent = new Agent({
    name: "KeyP Briefing Editor",
    model,
    outputType: editorialOutputSchema,
    instructions: `You are KeyP's briefing editor. Write in ${request.language === "ko" ? "natural Korean" : "clear English"}.

Preserve every candidateId and every factual claim. Do not add facts, merge distinct events, change URLs, or exaggerate certainty. Titles must be specific; summaries must state what changed; whyItMatters must connect the signal to the user's objective.`,
  });
  const fallbackHeadline =
    request.language === "ko" ? "지금 확인된 핵심 신호" : "Verified signals worth knowing now";
  const fallbackBriefing =
    request.language === "ko"
      ? `${plan.topic}에 관한 공개 출처를 병렬로 탐색하고 교차 검증했습니다.`
      : `KeyP searched and cross-checked public sources for ${plan.topic}.`;
  if (candidates.length === 0) {
    return {
      headline: fallbackHeadline,
      briefing: fallbackBriefing,
      editorial: new Map(),
      event: {
        id: "editor",
        name: "Briefing Editor",
        role: "editor",
        status: "success",
        detail: "No verified candidates required rewriting",
        durationMs: 0,
      },
    };
  }
  try {
    const result = await run(
      agent,
      JSON.stringify({
        objective: plan.objective,
        candidates: candidates.map((candidate) => ({
          candidateId: candidate.id,
          title: candidate.title,
          summary: candidate.summary,
          evidence: candidate.evidence,
          sourceName: candidate.sourceName,
        })),
      }),
      { maxTurns: 2 },
    );
    const output = editorialOutputSchema.parse(result.finalOutput);
    return {
      headline: output.headline,
      briefing: output.briefing,
      editorial: new Map(output.items.map((item) => [item.candidateId, item])),
      event: {
        id: "editor",
        name: "Briefing Editor",
        role: "editor",
        status: "success",
        detail: `Prepared ${output.items.length} source-preserving briefs`,
        durationMs: Date.now() - started,
      },
    };
  } catch (error) {
    return {
      headline: fallbackHeadline,
      briefing: fallbackBriefing,
      editorial: new Map(
        candidates.map((candidate) => [
          candidate.id,
          {
            title: candidate.title,
            summary: candidate.summary,
            whyItMatters: candidate.evidence,
          },
        ]),
      ),
      event: {
        id: "editor",
        name: "Briefing Editor",
        role: "editor",
        status: "partial",
        detail: error instanceof Error ? error.message : "Editor fallback",
        durationMs: Date.now() - started,
      },
    };
  }
}

export async function runLiveSwarm(request: RunRequest): Promise<RunResponse> {
  const wallStarted = Date.now();
  const { model } = requireRuntime();
  const { plan, event: managerEvent } = await runPlanner(request, model);

  const [scoutRuns, adapters] = await Promise.all([
    Promise.all(plan.lanes.map((lane) => runScout({ lane, request, plan, model }))),
    collectPublicAdapters(plan, request),
  ]);
  const allCandidates = dedupeCandidates([
    ...scoutRuns.flatMap((run) => run.candidates),
    ...adapters.candidates,
  ])
    .filter((candidate) => !request.knownUrls.includes(canonicalUrl(candidate.url)))
    .filter((candidate) => isFresh(candidate, request))
    .slice(0, 30);

  const gateStarted = Date.now();
  const probes = await Promise.all(
    allCandidates.map(async (candidate) => ({
      candidate,
      result: await probePublicUrl(candidate.url),
    })),
  );
  const verified = probes
    .filter((probe) => probe.result.ok)
    .map((probe) => probe.candidate);
  const blockedReasons = probes
    .filter((probe) => !probe.result.ok)
    .reduce<Record<string, number>>((counts, probe) => {
      const reason = probe.result.reason ?? "unknown";
      counts[reason] = (counts[reason] ?? 0) + 1;
      return counts;
    }, {});
  const blockedSummary = Object.entries(blockedReasons)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(", ");
  const gateEvent: AgentEvent = {
    id: "gate",
    name: "Evidence gate",
    role: "gate",
    status: verified.length > 0 || allCandidates.length === 0 ? "success" : "partial",
    detail: `Verified ${verified.length} of ${allCandidates.length} unique, fresh candidates${blockedSummary ? `; blocked ${blockedSummary}` : ""}`,
    durationMs: Date.now() - gateStarted,
  };

  const judgeRuns = await Promise.all(
    DIMENSIONS.map((dimension) =>
      runJudge({ dimension, candidates: verified, request, plan, model }),
    ),
  );
  const scores = Object.fromEntries(
    DIMENSIONS.map((dimension, index) => [dimension, judgeRuns[index]!.scores]),
  ) as Record<JudgeDimension, JudgeScore[]>;

  const preliminary = fuseSignals({
    candidates: verified,
    scores,
    request,
    editorial: new Map(),
  });
  const selectedIds = new Set(preliminary.map((signal) => signal.id));
  const selectedCandidates = verified.filter((candidate) => selectedIds.has(candidate.id));
  const editor = await runEditor({
    candidates: selectedCandidates,
    request,
    plan,
    model,
  });
  const signals = fuseSignals({
    candidates: verified,
    scores,
    request,
    editorial: editor.editorial,
  });
  const events = [
    managerEvent,
    ...scoutRuns.map((item) => item.event),
    adapters.event,
    gateEvent,
    ...judgeRuns.map((item) => item.event),
    editor.event,
  ];
  const wallClockMs = Date.now() - wallStarted;
  const estimatedSequentialMs = events.reduce(
    (total, event) => total + event.durationMs,
    0,
  );
  return {
    runId: makeRunId(),
    mode: "live",
    model,
    generatedAt: new Date().toISOString(),
    headline: editor.headline,
    briefing: editor.briefing,
    plan,
    signals,
    events,
    metrics: {
      laneCount: plan.lanes.length,
      candidateCount: scoutRuns.reduce(
        (total, item) => total + item.candidates.length,
        adapters.candidates.length,
      ),
      verifiedCount: verified.length,
      selectedCount: signals.length,
      sourceCoverage: [...new Set(signals.map((signal) => signal.sourceType))],
      wallClockMs,
      estimatedSequentialMs,
      parallelSpeedup: Number(
        (estimatedSequentialMs / Math.max(wallClockMs, 1)).toFixed(1),
      ),
    },
  };
}
