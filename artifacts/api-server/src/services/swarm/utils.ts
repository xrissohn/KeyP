import { createHash, randomUUID } from "node:crypto";
import type { CandidateSignal, SwarmSourceType } from "./types";

export function makeRunId(): string {
  return `swarm_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function makeCandidateId(url: string, title: string): string {
  return createHash("sha256")
    .update(`${url.trim()}\n${title.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

export function minutesSince(value?: string | number | Date | null): number {
  if (value === undefined || value === null) return 360;
  const ms =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) return 360;
  return Math.max(0, Math.round((Date.now() - ms) / 60_000));
}

export function detectSourceType(url: string): SwarmSourceType {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "rss";
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host === "x.com" || host.endsWith("twitter.com")) return "twitter";
  if (host.endsWith("reddit.com") || host === "redd.it") return "reddit";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "facebook";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("threads.net")) return "threads";
  if (host === "bsky.app" || host.endsWith("bsky.social")) return "bluesky";
  if (host.includes("mastodon") || host.endsWith("mstdn.social"))
    return "mastodon";
  if (host === "blog.naver.com" || host.endsWith("post.naver.com"))
    return "naver_blog";
  if (host === "news.ycombinator.com" || host === "hn.algolia.com")
    return "hackernews";
  if (
    /news|nytimes|reuters|apnews|yonhap|chosun|joongang|hani|bbc|cnn/.test(host)
  ) {
    return "news";
  }
  return "rss";
}

export function sourceNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "web";
  }
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

export function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 2),
  );
}

export function jaccard(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function dedupeCandidates(
  candidates: CandidateSignal[],
): CandidateSignal[] {
  const kept: CandidateSignal[] = [];
  const seenUrls = new Set<string>();
  for (const candidate of candidates) {
    const canonical = canonicalUrl(candidate.url);
    if (seenUrls.has(canonical)) continue;
    const isNearDuplicate = kept.some(
      (prior) =>
        jaccard(
          `${candidate.title} ${candidate.summary}`,
          `${prior.title} ${prior.summary}`,
        ) >= 0.72,
    );
    if (isNearDuplicate) continue;
    seenUrls.add(canonical);
    kept.push(candidate);
  }
  return kept;
}

export function isKnownDuplicate(
  candidate: Pick<CandidateSignal, "title" | "summary">,
  knownItems: Array<{ title: string; summary: string }>,
): boolean {
  return knownItems.some(
    (known) =>
      jaccard(
        `${candidate.title} ${candidate.summary}`,
        `${known.title} ${known.summary}`,
      ) >= 0.58,
  );
}

function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}
