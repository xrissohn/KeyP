import { z } from "zod";

export const laneSchema = z.enum([
  "official",
  "breaking",
  "social",
  "video",
  "community",
  "korea",
]);

export const runRequestSchema = z.object({
  interest: z.string().trim().min(3).max(600),
  language: z.enum(["ko", "en"]).default("ko"),
  freshnessHours: z.number().int().min(1).max(720).default(72),
  mode: z.enum(["live", "demo"]).default("live"),
  knownUrls: z.array(z.string().url()).max(100).default([]),
});

export const laneTaskSchema = z.object({
  lane: laneSchema,
  label: z.string().min(1).max(60),
  query: z.string().min(2).max(280),
  targets: z.array(z.string().min(1).max(80)).min(1).max(8),
});

export const interestPlanSchema = z.object({
  topic: z.string().min(1).max(180),
  objective: z.string().min(1).max(500),
  entities: z.array(z.string().min(1).max(100)).max(10),
  locations: z.array(z.string().min(1).max(100)).max(6),
  exclusions: z.array(z.string().min(1).max(160)).max(8),
  lanes: z.array(laneTaskSchema).length(6),
});

export const sourceTypeSchema = z.enum([
  "official",
  "news",
  "x",
  "youtube",
  "reddit",
  "instagram",
  "tiktok",
  "threads",
  "bluesky",
  "facebook",
  "mastodon",
  "naver",
  "community",
  "web",
]);

export const candidateSchema = z.object({
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(1200),
  // Structured Outputs supports a strict JSON Schema subset and rejects the
  // `format: uri` emitted by z.string().url(). URL validity is enforced by the
  // deterministic protocol, DNS, redirect, and HTTP gate before delivery.
  url: z.string().trim().min(8).max(2048),
  sourceName: z.string().min(1).max(140),
  sourceType: sourceTypeSchema,
  publishedAt: z.string().nullable(),
  eventAt: z.string().nullable(),
  evidence: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(60)).max(8),
});

export const scoutOutputSchema = z.object({
  signals: z.array(candidateSchema).max(6),
});

export const judgeScoreSchema = z.object({
  candidateId: z.string(),
  score: z.number().int().min(0).max(100),
  include: z.boolean(),
  reason: z.string().min(1).max(240),
});

export const judgeOutputSchema = z.object({
  scores: z.array(judgeScoreSchema).max(36),
});

export const editorialItemSchema = z.object({
  candidateId: z.string(),
  title: z.string().min(1).max(220),
  summary: z.string().min(1).max(600),
  whyItMatters: z.string().min(1).max(360),
});

export const editorialOutputSchema = z.object({
  headline: z.string().min(1).max(180),
  briefing: z.string().min(1).max(500),
  items: z.array(editorialItemSchema).max(8),
});

export type RunRequest = z.infer<typeof runRequestSchema>;
export type Lane = z.infer<typeof laneSchema>;
export type LaneTask = z.infer<typeof laneTaskSchema>;
export type InterestPlan = z.infer<typeof interestPlanSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type Candidate = z.infer<typeof candidateSchema> & {
  id: string;
  lane: Lane;
};
export type JudgeScore = z.infer<typeof judgeScoreSchema>;

export interface AgentEvent {
  id: string;
  name: string;
  role: "manager" | "scout" | "judge" | "editor" | "gate";
  lane?: Lane;
  status: "success" | "partial" | "failed";
  detail: string;
  durationMs: number;
}

export interface Signal {
  id: string;
  lane: Lane;
  title: string;
  summary: string;
  whyItMatters: string;
  url: string;
  sourceName: string;
  sourceType: SourceType;
  publishedAt: string | null;
  eventAt: string | null;
  tags: string[];
  confidence: number;
  dimensions: {
    credibility: number;
    relevance: number;
    freshness: number;
    novelty: number;
  };
}

export interface RunResponse {
  runId: string;
  mode: "live" | "demo";
  model: string;
  generatedAt: string;
  headline: string;
  briefing: string;
  plan: InterestPlan;
  signals: Signal[];
  events: AgentEvent[];
  metrics: {
    laneCount: number;
    candidateCount: number;
    verifiedCount: number;
    selectedCount: number;
    sourceCoverage: SourceType[];
    wallClockMs: number;
    estimatedSequentialMs: number;
    parallelSpeedup: number;
  };
}
