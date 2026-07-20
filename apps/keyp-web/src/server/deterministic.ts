import { createHash, randomUUID } from "node:crypto";
import type {
  Candidate,
  JudgeScore,
  Lane,
  RunRequest,
  Signal,
  SourceType,
} from "../shared/contracts.js";

export const DIMENSION_WEIGHTS = {
  credibility: 0.3,
  relevance: 0.3,
  freshness: 0.25,
  novelty: 0.15,
} as const;

export type JudgeDimension = keyof typeof DIMENSION_WEIGHTS;

export function makeRunId(): string {
  return `keyp_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.startsWith("utm_") ||
        ["ref", "source", "fbclid", "gclid", "igshid"].includes(key)
      ) {
        url.searchParams.delete(key);
      }
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

export function candidateId(url: string, title: string): string {
  return createHash("sha256")
    .update(`${canonicalUrl(url)}\n${normalizeText(title)}`)
    .digest("hex")
    .slice(0, 16);
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 2),
  );
}

export function jaccard(leftText: string, rightText: string): number {
  const left = tokenSet(leftText);
  const right = tokenSet(rightText);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const result: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const canonical = canonicalUrl(candidate.url);
    if (seen.has(canonical)) continue;
    const duplicate = result.some(
      (item) =>
        jaccard(
          `${item.title} ${item.summary}`,
          `${candidate.title} ${candidate.summary}`,
        ) >= 0.72,
    );
    if (duplicate) continue;
    seen.add(canonical);
    result.push(candidate);
  }
  return result;
}

export function detectSourceType(raw: string): SourceType {
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "web";
  }
  if (host === "x.com" || host.endsWith("twitter.com")) return "x";
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("reddit.com") || host === "redd.it") return "reddit";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("threads.net")) return "threads";
  if (host === "bsky.app" || host.endsWith("bsky.social")) return "bluesky";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "facebook";
  if (host.includes("mastodon") || host.endsWith("mstdn.social")) return "mastodon";
  if (host.endsWith("naver.com")) return "naver";
  if (host === "news.ycombinator.com" || host.includes("forum")) {
    return "community";
  }
  if (/news|reuters|apnews|bbc|cnn|yonhap|hani|chosun|joongang/.test(host)) {
    return "news";
  }
  if (/\.gov$|\.go\.kr$|\.edu$|openai\.com$/.test(host)) return "official";
  return "web";
}

export function sourceNameFromUrl(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "Public web";
  }
}

export function isFresh(candidate: Candidate, request: RunRequest): boolean {
  const value = candidate.eventAt ?? candidate.publishedAt;
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp <= request.freshnessHours * 60 * 60 * 1000;
}

export function deterministicDimensionScore(
  dimension: JudgeDimension,
  candidate: Candidate,
  request: RunRequest,
): number {
  if (dimension === "freshness") {
    const value = candidate.eventAt ?? candidate.publishedAt;
    if (!value) return 55;
    const ageHours = Math.max(
      0,
      (Date.now() - new Date(value).getTime()) / (60 * 60 * 1000),
    );
    if (!Number.isFinite(ageHours)) return 50;
    return Math.max(20, Math.round(100 - (ageHours / request.freshnessHours) * 55));
  }
  if (dimension === "credibility") {
    const base: Record<SourceType, number> = {
      official: 92,
      news: 82,
      web: 68,
      community: 62,
      youtube: 64,
      reddit: 58,
      x: 58,
      instagram: 55,
      tiktok: 50,
      threads: 55,
      bluesky: 58,
      facebook: 55,
      mastodon: 58,
      naver: 68,
    };
    return base[candidate.sourceType];
  }
  if (dimension === "relevance") {
    return Math.round(
      45 + 55 * jaccard(request.interest, `${candidate.title} ${candidate.summary}`),
    );
  }
  return 72;
}

export function fuseSignals(input: {
  candidates: Candidate[];
  scores: Record<JudgeDimension, JudgeScore[]>;
  request: RunRequest;
  editorial: Map<
    string,
    { title: string; summary: string; whyItMatters: string }
  >;
  limit?: number;
}): Signal[] {
  const { candidates, scores, request, editorial, limit = 8 } = input;
  return candidates
    .flatMap((candidate): Signal[] => {
      const dimensions = Object.fromEntries(
        (Object.keys(DIMENSION_WEIGHTS) as JudgeDimension[]).map((dimension) => {
          const judged = scores[dimension].find(
            (item) => item.candidateId === candidate.id,
          );
          return [
            dimension,
            judged?.score ?? deterministicDimensionScore(dimension, candidate, request),
          ];
        }),
      ) as Signal["dimensions"];
      const excluded = (Object.keys(DIMENSION_WEIGHTS) as JudgeDimension[]).some(
        (dimension) =>
          scores[dimension].find((item) => item.candidateId === candidate.id)
            ?.include === false,
      );
      if (
        excluded ||
        dimensions.relevance < 40 ||
        dimensions.novelty < 40 ||
        !isFresh(candidate, request)
      ) {
        return [];
      }
      const confidence = Math.round(
        dimensions.credibility * DIMENSION_WEIGHTS.credibility +
          dimensions.relevance * DIMENSION_WEIGHTS.relevance +
          dimensions.freshness * DIMENSION_WEIGHTS.freshness +
          dimensions.novelty * DIMENSION_WEIGHTS.novelty,
      );
      const copy = editorial.get(candidate.id);
      return [
        {
          id: candidate.id,
          lane: candidate.lane,
          title: copy?.title ?? candidate.title,
          summary: copy?.summary ?? candidate.summary,
          whyItMatters: copy?.whyItMatters ?? candidate.evidence,
          url: canonicalUrl(candidate.url),
          sourceName: candidate.sourceName,
          sourceType: candidate.sourceType,
          publishedAt: candidate.publishedAt,
          eventAt: candidate.eventAt,
          tags: candidate.tags,
          confidence,
          dimensions,
        },
      ];
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

export function createCandidate(
  lane: Lane,
  input: {
    title: string;
    summary: string;
    url: string;
    sourceName?: string;
    sourceType?: SourceType;
    publishedAt?: string | null;
    eventAt?: string | null;
    evidence: string;
    tags?: string[];
  },
): Candidate {
  return {
    ...input,
    id: candidateId(input.url, input.title),
    lane,
    sourceName: input.sourceName ?? sourceNameFromUrl(input.url),
    sourceType: input.sourceType ?? detectSourceType(input.url),
    publishedAt: input.publishedAt ?? null,
    eventAt: input.eventAt ?? null,
    tags: input.tags ?? [],
  };
}
