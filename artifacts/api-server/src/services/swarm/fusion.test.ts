import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CandidateSignal, JudgeScore } from "./types";

// The runtime imports the existing Replit OpenRouter client. Dummy values are
// sufficient here because fusion is deterministic and never makes a request.
process.env["AI_INTEGRATIONS_OPENROUTER_BASE_URL"] ??= "https://example.invalid/v1";
process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"] ??= "offline-test";

const { fuseCandidates } = await import("./runtime");

function candidate(overrides: Partial<CandidateSignal> = {}): CandidateSignal {
  return {
    id: "candidate-1",
    lane: "official",
    title: "OpenAI launches a new agent platform",
    summary: "The platform was announced today for developers.",
    url: "https://openai.com/news/agent-platform",
    sourceType: "rss",
    sourceName: "OpenAI",
    minutesAgo: 15,
    eventMinutesAgo: 15,
    originalLanguage: "en",
    tags: ["OpenAI", "agents"],
    ...overrides,
  };
}

function scores(candidateId: string, values: Record<string, number>) {
  return (["credibility", "relevance", "freshness", "novelty"] as const).map((dimension) => ({
    dimension,
    scores: [{ candidateId, score: values[dimension] ?? 80, include: true, reason: "fixture" } satisfies JudgeScore],
  }));
}

describe("KeyP deterministic fusion", () => {
  it("computes the documented weighted confidence", () => {
    const signal = candidate();
    const fused = fuseCandidates(
      [signal],
      scores(signal.id, { credibility: 90, relevance: 80, freshness: 70, novelty: 60 }),
      { knownItems: [], maxAllowedEventMinutesAgo: 60 },
    );
    assert.equal(fused.length, 1);
    assert.equal(fused[0]?.confidence, 78);
  });

  it("rejects events older than the strict freshness floor", () => {
    const signal = candidate({ eventMinutesAgo: 61 });
    assert.equal(
      fuseCandidates([signal], scores(signal.id, {}), {
        knownItems: [],
        maxAllowedEventMinutesAgo: 60,
      }).length,
      0,
    );
  });

  it("rejects low-relevance and low-novelty candidates regardless of the average", () => {
    const signal = candidate();
    assert.equal(
      fuseCandidates(
        [signal],
        scores(signal.id, { credibility: 100, relevance: 44, freshness: 100, novelty: 100 }),
        { knownItems: [], maxAllowedEventMinutesAgo: 60 },
      ).length,
      0,
    );
  });
});
