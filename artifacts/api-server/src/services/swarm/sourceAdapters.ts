import Parser from "rss-parser";
import type { CandidateSignal, SwarmPlan } from "./types";
import {
  detectSourceType,
  makeCandidateId,
  minutesSince,
  sourceNameFromUrl,
} from "./utils";

export interface AdapterRun {
  adapter: string;
  candidates: CandidateSignal[];
  durationMs: number;
  skipped?: boolean;
  error?: string;
}

const parser = new Parser({ timeout: 8_000 });

async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "KeyP-Swarm/2.0 (+https://keyp.site)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toCandidate(input: {
  title: string;
  summary?: string;
  url: string;
  sourceName?: string;
  publishedAt?: string;
  language?: string;
  tags?: string[];
  query?: string;
}): CandidateSignal | null {
  const title = stripHtml(input.title ?? "").slice(0, 280);
  const summary = stripHtml(input.summary ?? title).slice(0, 1_200);
  if (!title || !input.url.startsWith("http")) return null;
  const age = minutesSince(input.publishedAt);
  return {
    id: makeCandidateId(input.url, title),
    lane: "federated",
    title,
    summary,
    url: input.url,
    sourceType: detectSourceType(input.url),
    sourceName: input.sourceName || sourceNameFromUrl(input.url),
    publishedAt: input.publishedAt,
    minutesAgo: age,
    eventMinutesAgo: age,
    originalLanguage: input.language ?? "other",
    tags: (input.tags ?? []).slice(0, 6),
    matchedQuery: input.query,
  };
}

async function runAdapter(
  adapter: string,
  callback: () => Promise<CandidateSignal[]>,
  skipped = false,
): Promise<AdapterRun> {
  const started = Date.now();
  if (skipped) return { adapter, candidates: [], durationMs: 0, skipped: true };
  try {
    return {
      adapter,
      candidates: await callback(),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      adapter,
      candidates: [],
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : "adapter_failed",
    };
  }
}

async function searchSearxng(queries: string[]): Promise<CandidateSignal[]> {
  const base = process.env["SEARXNG_BASE_URL"]?.replace(/\/$/, "");
  if (!base) return [];
  const batches = await Promise.all(
    queries.slice(0, 2).map(async (query) => {
      const url = `${base}/search?format=json&categories=general&time_range=day&q=${encodeURIComponent(query)}`;
      const data = await fetchJson<{
        results?: Array<{
          title?: string;
          content?: string;
          url?: string;
          engine?: string;
          publishedDate?: string;
        }>;
      }>(url);
      return (data.results ?? []).slice(0, 8).flatMap((item) => {
        if (!item.title || !item.url) return [];
        const candidate = toCandidate({
          title: item.title,
          summary: item.content,
          url: item.url,
          sourceName: item.engine,
          publishedAt: item.publishedDate,
          query,
        });
        return candidate ? [candidate] : [];
      });
    }),
  );
  return batches.flat();
}

async function searchBluesky(query: string): Promise<CandidateSignal[]> {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=12&sort=latest`;
  const data = await fetchJson<{
    posts?: Array<{
      uri?: string;
      indexedAt?: string;
      author?: { handle?: string; displayName?: string };
      record?: { text?: string; createdAt?: string; langs?: string[] };
    }>;
  }>(url);
  return (data.posts ?? []).flatMap((post) => {
    const text = post.record?.text?.trim();
    const handle = post.author?.handle;
    const rkey = post.uri?.split("/").pop();
    if (!text || !handle || !rkey) return [];
    const candidate = toCandidate({
      title: text.slice(0, 140),
      summary: text,
      url: `https://bsky.app/profile/${handle}/post/${rkey}`,
      sourceName: post.author?.displayName || `@${handle}`,
      publishedAt: post.record?.createdAt || post.indexedAt,
      language: post.record?.langs?.[0],
      tags: ["bluesky"],
      query,
    });
    return candidate ? [candidate] : [];
  });
}

async function searchHackerNews(query: string): Promise<CandidateSignal[]> {
  const after = Math.floor(Date.now() / 1000) - 86_400;
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=12&numericFilters=created_at_i%3E${after}&query=${encodeURIComponent(query)}`;
  const data = await fetchJson<{
    hits?: Array<{
      objectID?: string;
      title?: string;
      story_title?: string;
      url?: string;
      story_url?: string;
      created_at?: string;
      author?: string;
    }>;
  }>(url);
  return (data.hits ?? []).flatMap((hit) => {
    const title = hit.title || hit.story_title;
    const target =
      hit.url ||
      hit.story_url ||
      (hit.objectID
        ? `https://news.ycombinator.com/item?id=${hit.objectID}`
        : undefined);
    if (!title || !target) return [];
    const candidate = toCandidate({
      title,
      summary: `${title} — submitted by ${hit.author ?? "HN user"}`,
      url: target,
      sourceName: "Hacker News",
      publishedAt: hit.created_at,
      language: "en",
      tags: ["hackernews"],
      query,
    });
    return candidate
      ? [{ ...candidate, sourceType: "hackernews" as const }]
      : [];
  });
}

async function searchGdelt(query: string): Promise<CandidateSignal[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=12&format=json&sort=hybridrel&timespan=1d`;
  const data = await fetchJson<{
    articles?: Array<{
      title?: string;
      url?: string;
      domain?: string;
      seendate?: string;
      language?: string;
      sourcecountry?: string;
    }>;
  }>(url, 12_000);
  return (data.articles ?? []).flatMap((article) => {
    if (!article.title || !article.url) return [];
    const candidate = toCandidate({
      title: article.title,
      summary: `${article.title}${article.sourcecountry ? ` (${article.sourcecountry})` : ""}`,
      url: article.url,
      sourceName: article.domain,
      publishedAt: article.seendate,
      language: article.language,
      tags: ["gdelt", "news"],
      query,
    });
    return candidate ? [candidate] : [];
  });
}

async function searchConfiguredRss(query: string): Promise<CandidateSignal[]> {
  const feeds = (process.env["KEYP_RSS_FEEDS"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("http"))
    .slice(0, 12);
  if (feeds.length === 0) return [];
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  const settled = await Promise.allSettled(
    feeds.map((feed) => parser.parseURL(feed)),
  );
  const candidates: CandidateSignal[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value.items.slice(0, 20)) {
      const haystack =
        `${item.title ?? ""} ${item.contentSnippet ?? ""}`.toLowerCase();
      if (
        tokens.length > 0 &&
        !tokens.some((token) => haystack.includes(token))
      )
        continue;
      const link = item.link;
      if (!item.title || !link) continue;
      const candidate = toCandidate({
        title: item.title,
        summary: item.contentSnippet || item.content,
        url: link,
        sourceName: result.value.title,
        publishedAt: item.isoDate || item.pubDate,
        tags: ["rss"],
        query,
      });
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

export async function collectFederatedSources(
  plan: SwarmPlan,
): Promise<AdapterRun[]> {
  const generalQuery = [
    plan.intent.topic,
    ...plan.intent.entities.slice(0, 4),
    ...plan.intent.locations.slice(0, 2),
  ]
    .filter(Boolean)
    .join(" ");
  const plannedQueries = plan.tasks
    .flatMap((task) => task.queries)
    .filter(Boolean);
  const queries = [...new Set([generalQuery, ...plannedQueries])];

  return Promise.all([
    runAdapter(
      "SearXNG",
      () => searchSearxng(queries),
      !process.env["SEARXNG_BASE_URL"],
    ),
    runAdapter("Bluesky Public API", () =>
      searchBluesky(queries[0] || generalQuery),
    ),
    runAdapter("Hacker News Algolia", () =>
      searchHackerNews(queries[0] || generalQuery),
    ),
    runAdapter("GDELT", () => searchGdelt(queries[0] || generalQuery)),
    runAdapter(
      "RSSHub/RSS",
      () => searchConfiguredRss(queries[0] || generalQuery),
      !process.env["KEYP_RSS_FEEDS"],
    ),
  ]);
}
