import type {
  AlertData,
  AgentStep,
  InterestSpecData,
} from "@workspace/api-zod";

export const SWARM_LANES = [
  "official",
  "breaking",
  "social",
  "video",
  "community",
  "korea",
] as const;

export type SwarmLane = (typeof SWARM_LANES)[number];

export type SwarmSourceType = AlertData["source"]["type"];

export interface RefinedIntent {
  topic: string;
  goal: string;
  entities: string[];
  locations: string[];
  languages: string[];
  urgency: "high" | "medium" | "low";
  freshnessMinutes: number;
  exclusions: string[];
}

export interface LaneTask {
  lane: SwarmLane;
  queries: string[];
  targetPlatforms: string[];
  rationale: string;
}

export interface SwarmPlan {
  intent: RefinedIntent;
  tasks: LaneTask[];
}

export interface CandidateSignal {
  id: string;
  lane: SwarmLane | "federated";
  title: string;
  summary: string;
  url: string;
  sourceType: SwarmSourceType;
  sourceName: string;
  publishedAt?: string;
  minutesAgo: number;
  eventMinutesAgo: number;
  originalLanguage: string;
  tags: string[];
  matchedQuery?: string;
}

export interface JudgeScore {
  candidateId: string;
  score: number;
  include: boolean;
  reason: string;
}

export interface FusedCandidate extends CandidateSignal {
  confidence: number;
  reason: string;
  dimensions: {
    credibility: number;
    relevance: number;
    freshness: number;
    novelty: number;
  };
}

export interface SwarmRunInput {
  spec: InterestSpecData;
  count: number;
  knownItems: Array<{ title: string; summary: string }>;
  userLanguage: "ko" | "en";
  maxAllowedEventMinutesAgo: number;
  probeUrl: (
    url: string,
    timeoutMs?: number,
  ) => Promise<{ ok: boolean; reason?: string }>;
  logger: {
    info: (obj: object, message: string) => void;
    warn: (obj: object, message: string) => void;
    error: (obj: object, message: string) => void;
  };
}

export interface SwarmRunResult {
  alerts: AlertData[];
  steps: AgentStep[];
  metrics: {
    runId: string;
    model: string;
    laneCount: number;
    candidateCount: number;
    reachableCount: number;
    selectedCount: number;
    wallClockMs: number;
    sequentialEstimateMs: number;
    parallelSpeedup: number;
    sourceCoverage: string[];
  };
}
