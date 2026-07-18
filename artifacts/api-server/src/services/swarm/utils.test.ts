import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CandidateSignal } from "./types";
import {
  dedupeCandidates,
  detectSourceType,
  isKnownDuplicate,
  jaccard,
  makeCandidateId,
} from "./utils";

function candidate(overrides: Partial<CandidateSignal> = {}): CandidateSignal {
  const title = overrides.title ?? "OpenAI launches a new agent platform";
  const url = overrides.url ?? "https://openai.com/news/agent-platform";
  return {
    id: makeCandidateId(url, title),
    lane: "official",
    title,
    summary: "OpenAI announced a new agent platform for developers today.",
    url,
    sourceType: "rss",
    sourceName: "OpenAI",
    minutesAgo: 15,
    eventMinutesAgo: 15,
    originalLanguage: "en",
    tags: ["OpenAI", "agents"],
    ...overrides,
  };
}

describe("KeyP swarm deterministic gates", () => {
  it("maps major public platforms to explicit source types", () => {
    assert.equal(detectSourceType("https://x.com/openai/status/1"), "twitter");
    assert.equal(
      detectSourceType("https://bsky.app/profile/openai.com/post/abc"),
      "bluesky",
    );
    assert.equal(
      detectSourceType("https://blog.naver.com/keyp/123"),
      "naver_blog",
    );
    assert.equal(
      detectSourceType("https://news.ycombinator.com/item?id=1"),
      "hackernews",
    );
    assert.equal(
      detectSourceType("https://www.youtube.com/watch?v=abc"),
      "youtube",
    );
  });

  it("canonicalizes tracking parameters and removes exact URL duplicates", () => {
    const first = candidate({ url: "https://example.com/story?utm_source=x" });
    const second = candidate({
      url: "https://example.com/story?utm_source=reddit",
    });
    assert.equal(dedupeCandidates([first, second]).length, 1);
  });

  it("removes semantic duplicates from different sources", () => {
    const first = candidate();
    const second = candidate({
      url: "https://news.example.com/openai-agent-platform",
      sourceName: "Example News",
    });
    assert.equal(dedupeCandidates([first, second]).length, 1);
  });

  it("detects already-delivered stories while preserving unrelated developments", () => {
    const signal = candidate();
    assert.equal(
      isKnownDuplicate(signal, [
        { title: signal.title, summary: signal.summary },
      ]),
      true,
    );
    assert.equal(
      isKnownDuplicate(signal, [
        {
          title: "Seoul weather update",
          summary: "Rain is expected this evening.",
        },
      ]),
      false,
    );
  });

  it("produces bounded similarity values for multilingual text", () => {
    const related = jaccard(
      "오픈AI 에이전트 플랫폼 출시",
      "오픈AI 새 에이전트 플랫폼 공개",
    );
    const unrelated = jaccard(
      "오픈AI 에이전트 플랫폼 출시",
      "서울 저녁 날씨 비 소식",
    );
    assert.ok(related > unrelated);
    assert.ok(related >= 0 && related <= 1);
  });
});
