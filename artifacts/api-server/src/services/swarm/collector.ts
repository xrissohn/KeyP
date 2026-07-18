import type { InterestSpecData } from "@workspace/api-zod";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import type { CandidateSignal, LaneTask, SwarmLane } from "./types";
import {
  detectSourceType,
  makeCandidateId,
  minutesSince,
  sourceNameFromUrl,
} from "./utils";

export interface LaneRun {
  task: LaneTask;
  candidates: CandidateSignal[];
  durationMs: number;
  error?: string;
}

const LANE_CONTRACTS: Record<SwarmLane, string> = {
  official:
    "Search official organizations, company blogs, government releases, research labs, event organizers, and primary-source announcement pages first.",
  breaking:
    "Search newly published news and first-party breaking updates. Prefer the source closest to the event and avoid recap articles about old events.",
  social:
    "Search PUBLIC posts indexed from X/Twitter, Threads, Facebook public pages, Bluesky, Mastodon, and public Instagram captions. Never access private profiles or gated personal data.",
  video:
    "Search recent public YouTube uploads, TikTok public pages, Instagram Reels public pages, livestream schedules, and creator community posts.",
  community:
    "Search public Reddit threads, Hacker News, public forums, Discord announcement pages that are web-visible, and specialist communities.",
  korea:
    "Search Korean-language primary sources including Naver News, Naver Blog, public Naver Cafe pages, Daum, Korean public communities, YouTube KR, and X KR.",
};

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("collector_json_missing");
  return JSON.parse(fenced.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1"));
}

function normalizeLanguage(value: unknown): string {
  if (typeof value !== "string") return "other";
  const code = value.toLowerCase().split(/[-_]/)[0];
  return code && code.length <= 5 ? code : "other";
}

function normalizeCandidate(
  raw: unknown,
  lane: SwarmLane,
): CandidateSignal | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const title =
    typeof item.title === "string" ? item.title.trim().slice(0, 280) : "";
  const summary =
    typeof item.summary === "string" ? item.summary.trim().slice(0, 1_200) : "";
  const url = typeof item.url === "string" ? item.url.trim() : "";
  if (!title || !summary || !/^https?:\/\//i.test(url)) return null;
  const publishedAt =
    typeof item.publishedAt === "string" ? item.publishedAt : undefined;
  const reportedMinutes = Number(item.minutesAgo);
  const reportedEventMinutes = Number(item.eventMinutesAgo);
  const age = Number.isFinite(reportedMinutes)
    ? Math.max(0, Math.round(reportedMinutes))
    : minutesSince(publishedAt);
  const eventAge = Number.isFinite(reportedEventMinutes)
    ? Math.max(age, Math.round(reportedEventMinutes))
    : age;
  const sourceName =
    typeof item.sourceName === "string" && item.sourceName.trim()
      ? item.sourceName.trim().slice(0, 160)
      : sourceNameFromUrl(url);
  return {
    id: makeCandidateId(url, title),
    lane,
    title,
    summary,
    url,
    sourceType: detectSourceType(url),
    sourceName,
    publishedAt,
    minutesAgo: age,
    eventMinutesAgo: eventAge,
    originalLanguage: normalizeLanguage(item.originalLanguage),
    tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 6) : [],
    matchedQuery:
      typeof item.matchedQuery === "string"
        ? item.matchedQuery.slice(0, 240)
        : undefined,
  };
}

export async function collectLane(
  task: LaneTask,
  spec: InterestSpecData,
  knownItems: Array<{ title: string; summary: string }>,
): Promise<LaneRun> {
  const started = Date.now();
  const model = process.env["KEYP_SEARCH_MODEL"] || "perplexity/sonar-pro";
  const knownBlock =
    knownItems.length === 0
      ? "(none)"
      : knownItems
          .slice(0, 20)
          .map(
            (item, index) =>
              `${index + 1}. ${item.title} — ${item.summary.slice(0, 180)}`,
          )
          .join("\n");
  try {
    const completion = await openrouter.chat.completions.create(
      {
        model,
        max_tokens: 4_096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are KeyP's ${task.lane.toUpperCase()} Source Scout, one bounded specialist in a parallel public-information swarm.

MISSION
${LANE_CONTRACTS[task.lane]}

HARD RULES
- Search only information publicly accessible on the open web. Never identify, profile, or deanonymize a private person.
- Work the provided queries in order and use site/domain restrictions for the named platforms.
- Every URL must be copied from an actual search result. Never construct or guess a URL.
- Prefer events that actually happened recently, not recent articles recapping an old event.
- Return zero results when no trustworthy, on-topic, recent item exists. Silence is better than fabrication.
- Keep original-language title and summary. Do not translate.
- Do not return a story that matches an already-delivered item.

Return strict JSON only:
{"signals":[{"title":"original headline or post text","summary":"1-3 factual sentences","url":"exact public URL","sourceName":"publisher or public handle","publishedAt":"ISO-8601 when known","minutesAgo":30,"eventMinutesAgo":30,"originalLanguage":"ko|en|ja|zh|es|fr|de|other","tags":["tag"],"matchedQuery":"the query that found it"}]}`,
          },
          {
            role: "user",
            content: `INTEREST SPEC
${JSON.stringify(spec)}

TARGET PLATFORMS
${task.targetPlatforms.join(", ")}

ORDERED QUERIES
${task.queries.map((query, index) => `${index + 1}. ${query}`).join("\n")}

WHY THIS LANE
${task.rationale}

ALREADY DELIVERED — DO NOT REPEAT
${knownBlock}

Find at most 6 high-signal public items.`,
          },
        ],
      },
      { timeout: 40_000 },
    );
    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = extractJson(content) as { signals?: unknown[] };
    const candidates = (Array.isArray(parsed.signals) ? parsed.signals : [])
      .map((item) => normalizeCandidate(item, task.lane))
      .filter((item): item is CandidateSignal => item !== null)
      .slice(0, 6);
    return { task, candidates, durationMs: Date.now() - started };
  } catch (error) {
    return {
      task,
      candidates: [],
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : "collector_failed",
    };
  }
}
