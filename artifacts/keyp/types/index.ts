export type IntentType =
  | 'monitor'
  | 'alert'
  | 'opportunity'
  | 'match'
  | 'creator_watch'
  | 'travel'
  | 'local_signal';

export type MatchMode =
  | 'friend'
  | 'companion'
  | 'collaborate'
  | 'meal_mate'
  | 'date';

export type SourceType =
  | 'youtube'
  | 'twitter'
  | 'reddit'
  | 'rss'
  | 'match';

export type Urgency = 'low' | 'medium' | 'high';
export type TrustNeed = 'low' | 'medium' | 'high';
export type PrivacyLevel = 'public' | 'friends' | 'private';
export type FreshnessLevel = 'live' | 'hot' | 'recent' | 'older';
export type FeedbackType = 'like' | 'dislike' | 'hide' | 'more';
export type MatchStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface InterestSpec {
  id: string;
  userId: string;
  rawText: string;
  intentType: IntentType;
  topic: string;
  entities: string[];
  locationScope?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  urgency: Urgency;
  desiredOutcome: string;
  trustNeed: TrustNeed;
  matchMode?: MatchMode;
  privacyLevel: PrivacyLevel;
  negativeConstraints: string[];
  suggestedSources: SourceType[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Interest {
  id: string;
  displayName: string;
  spec: InterestSpec;
  alertCount: number;
  lastAlertAt?: string;
  color: string;
  emoji: string;
}

export interface AlertSource {
  type: SourceType;
  name: string;
  url?: string;
}

export interface Alert {
  id: string;
  interestId: string;
  interestName: string;
  title: string;
  summary: string;
  reason: string;
  confidence: number;
  freshness: FreshnessLevel;
  source: AlertSource;
  originalUrl?: string;
  tags: string[];
  isSaved: boolean;
  feedback?: FeedbackType;
  createdAt: string;
  isMatch?: boolean;
}

export interface MatchedUser {
  id: string;
  displayName: string;
  bio?: string;
  location?: string;
  interests: string[];
}

export interface Match {
  id: string;
  matchedUser: MatchedUser;
  sharedInterests: string[];
  score: number;
  mode: MatchMode;
  status: MatchStatus;
  explanation: string;
  createdAt: string;
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  bio?: string;
  location?: string;
  joinedAt: string;
  interestCount: number;
  alertCount: number;
  matchCount: number;
}

export interface SourcePriority {
  source: SourceType;
  score: number;
  reason: string;
}
