import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunRequest } from "../shared/contracts.js";
import {
  canonicalUrl,
  createCandidate,
  dedupeCandidates,
  detectSourceType,
  fuseSignals,
  jaccard,
  type JudgeDimension,
} from "./deterministic.js";

const request: RunRequest = {
  interest: "OpenAI agent SDK release",
  language: "en",
  freshnessHours: 72,
  mode: "demo",
  knownUrls: [],
};

describe("KeyP deterministic evidence gates", () => {
  it("removes tracking parameters while preserving meaningful query values", () => {
    assert.equal(
      canonicalUrl("https://example.com/story?id=42&utm_source=x&fbclid=nope#top"),
      "https://example.com/story?id=42",
    );
  });

  it("maps public social URLs to explicit source types", () => {
    assert.equal(detectSourceType("https://www.facebook.com/openai/posts/1"), "facebook");
    assert.equal(detectSourceType("https://bsky.app/profile/openai.com/post/1"), "bluesky");
    assert.equal(detectSourceType("https://www.youtube.com/watch?v=test"), "youtube");
  });

  it("detects multilingual overlap and removes repeated stories", () => {
    assert.ok(jaccard("OpenAI agent SDK release today", "OpenAI agent SDK release details") > 0.5);
    const first = createCandidate("official", {
      title: "OpenAI agent SDK release today",
      summary: "The new agent SDK release is available today for developers.",
      url: "https://example.com/release?utm_source=one",
      evidence: "Primary announcement",
    });
    const repeated = createCandidate("breaking", {
      title: "OpenAI agent SDK release today",
      summary: "The new agent SDK release is available today for developers.",
      url: "https://example.com/release?utm_source=two",
      evidence: "Repeated report",
    });
    assert.equal(dedupeCandidates([first, repeated]).length, 1);
  });

  it("uses the documented weighted score and hard relevance gate", () => {
    const candidate = createCandidate("official", {
      title: "OpenAI agent SDK release",
      summary: "Official release details",
      url: "https://openai.com/release",
      sourceType: "official",
      publishedAt: new Date().toISOString(),
      evidence: "First-party source",
    });
    const dimensions: JudgeDimension[] = ["credibility", "relevance", "freshness", "novelty"];
    const values: Record<JudgeDimension, number> = {
      credibility: 90,
      relevance: 80,
      freshness: 70,
      novelty: 60,
    };
    const scores = Object.fromEntries(
      dimensions.map((dimension) => [dimension, [{ candidateId: candidate.id, score: values[dimension], include: true, reason: "test" }]]),
    ) as Parameters<typeof fuseSignals>[0]["scores"];
    const accepted = fuseSignals({ candidates: [candidate], scores, request, editorial: new Map() });
    assert.equal(accepted[0]?.confidence, 78);

    scores.relevance[0] = { ...scores.relevance[0]!, score: 39 };
    assert.equal(fuseSignals({ candidates: [candidate], scores, request, editorial: new Map() }).length, 0);
  });
});
