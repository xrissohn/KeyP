import type {
  AgentEvent,
  Candidate,
  InterestPlan,
  Lane,
  RunRequest,
  SourceType,
} from "../shared/contracts.js";
import { createCandidate } from "./deterministic.js";

interface AdapterResult {
  name: string;
  candidates: Candidate[];
  durationMs: number;
  error?: string;
  skipped?: boolean;
}

async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "KeyP-Web/1.0 (+https://github.com/xrissohn/KeyP)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function clean(value: string | undefined, maximum: number): string {
  return (value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function gdeltDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

async function runAdapter(
  name: string,
  callback: () => Promise<Candidate[]>,
  skipped = false,
): Promise<AdapterResult> {
  const started = Date.now();
  if (skipped) return { name, candidates: [], durationMs: 0, skipped: true };
  try {
    return { name, candidates: await callback(), durationMs: Date.now() - started };
  } catch (error) {
    return {
      name,
      candidates: [],
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : "adapter_failed",
    };
  }
}

async function searchBluesky(query: string): Promise<Candidate[]> {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=8&sort=latest`;
  const data = await fetchJson<{
    posts?: Array<{
      uri?: string;
      indexedAt?: string;
      author?: { handle?: string; displayName?: string };
      record?: { text?: string; createdAt?: string };
    }>;
  }>(url);
  return (data.posts ?? []).flatMap((post) => {
    const text = clean(post.record?.text, 1_000);
    const handle = post.author?.handle;
    const postKey = post.uri?.split("/").pop();
    if (!text || !handle || !postKey) return [];
    return [
      createCandidate("social", {
        title: text.slice(0, 180),
        summary: text,
        url: `https://bsky.app/profile/${handle}/post/${postKey}`,
        sourceName: post.author?.displayName || `@${handle}`,
        sourceType: "bluesky",
        publishedAt: post.record?.createdAt || post.indexedAt || null,
        eventAt: post.record?.createdAt || post.indexedAt || null,
        evidence: "Public post returned by Bluesky's documented AppView search endpoint.",
        tags: ["bluesky", "public-social"],
      }),
    ];
  });
}

async function searchHackerNews(query: string, freshnessHours: number): Promise<Candidate[]> {
  const after = Math.floor(Date.now() / 1_000) - freshnessHours * 3_600;
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=8&numericFilters=created_at_i%3E${after}&query=${encodeURIComponent(query)}`;
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
    const title = clean(hit.title || hit.story_title, 280);
    const target = hit.url || hit.story_url || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : undefined);
    if (!title || !target) return [];
    return [
      createCandidate("community", {
        title,
        summary: `${title} — submitted by ${hit.author ?? "an HN user"}`,
        url: target,
        sourceName: "Hacker News",
        sourceType: "community",
        publishedAt: hit.created_at ?? null,
        eventAt: hit.created_at ?? null,
        evidence: "Recent public story returned by the Hacker News Algolia API.",
        tags: ["hacker-news", "community"],
      }),
    ];
  });
}

async function searchGdelt(query: string, freshnessHours: number): Promise<Candidate[]> {
  const days = Math.max(1, Math.ceil(freshnessHours / 24));
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=8&format=json&sort=hybridrel&timespan=${days}d`;
  const data = await fetchJson<{
    articles?: Array<{
      title?: string;
      url?: string;
      domain?: string;
      seendate?: string;
      sourcecountry?: string;
    }>;
  }>(url, 12_000);
  return (data.articles ?? []).flatMap((article) => {
    const title = clean(article.title, 280);
    if (!title || !article.url) return [];
    const seenAt = gdeltDate(article.seendate);
    return [
      createCandidate("breaking", {
        title,
        summary: `${title}${article.sourcecountry ? ` (${article.sourcecountry})` : ""}`,
        url: article.url,
        sourceName: article.domain,
        sourceType: "news",
        publishedAt: seenAt,
        eventAt: seenAt,
        evidence: "Recent global-news metadata returned by the GDELT DOC API.",
        tags: ["gdelt", "news"],
      }),
    ];
  });
}

async function searchSearxng(query: string): Promise<Candidate[]> {
  const base = process.env.SEARXNG_BASE_URL?.replace(/\/$/, "");
  if (!base) return [];
  const url = `${base}/search?format=json&categories=general&time_range=day&q=${encodeURIComponent(query)}`;
  const data = await fetchJson<{
    results?: Array<{ title?: string; content?: string; url?: string; engine?: string; publishedDate?: string }>;
  }>(url);
  return (data.results ?? []).slice(0, 8).flatMap((item) => {
    const title = clean(item.title, 280);
    const summary = clean(item.content, 1_200) || title;
    if (!title || !item.url) return [];
    return [
      createCandidate("official", {
        title,
        summary,
        url: item.url,
        sourceName: item.engine,
        publishedAt: item.publishedDate ?? null,
        eventAt: item.publishedDate ?? null,
        evidence: "Public result returned by the operator's SearXNG metasearch instance.",
        tags: ["searxng", "metasearch"],
      }),
    ];
  });
}

export async function collectPublicAdapters(
  plan: InterestPlan,
  request: RunRequest,
): Promise<{ candidates: Candidate[]; event: AgentEvent; runs: AdapterResult[] }> {
  const started = Date.now();
  const query = [plan.topic, ...plan.entities.slice(0, 3), ...plan.locations.slice(0, 2)]
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
  const runs = await Promise.all([
    runAdapter("Bluesky Public API", () => searchBluesky(query)),
    runAdapter("Hacker News Algolia", () => searchHackerNews(query, request.freshnessHours)),
    runAdapter("GDELT DOC API", () => searchGdelt(query, request.freshnessHours)),
    runAdapter("SearXNG", () => searchSearxng(query), !process.env.SEARXNG_BASE_URL),
  ]);
  const candidates = runs.flatMap((run) => run.candidates);
  const completed = runs.filter((run) => !run.error && !run.skipped).length;
  return {
    candidates,
    runs,
    event: {
      id: "public-adapters",
      name: "Public source adapters",
      role: "gate",
      status: completed > 0 ? "success" : "partial",
      detail: `${completed} public adapters returned ${candidates.length} candidates`,
      durationMs: Date.now() - started,
    },
  };
}
