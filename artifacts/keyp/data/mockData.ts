import type { Alert, Interest, Match, User } from '@/types';

// Default user shown in the profile until real auth is wired up.
export const MOCK_CURRENT_USER: User = {
  id: 'user_001',
  displayName: '김민준',
  email: 'minjun@example.com',
  bio: 'K-pop, 여행, AI 기술에 관심 있어요',
  location: '서울',
  joinedAt: '2025-10-01',
  interestCount: 0,
  alertCount: 0,
  matchCount: 0,
};

export const INTEREST_COLORS = [
  '#5B7FFF',
  '#FF6B8A',
  '#4ADE80',
  '#FBBF24',
  '#A78BFA',
  '#34D399',
  '#FB7185',
  '#60A5FA',
];

// KeyP starts every user with a clean slate. Interests, alerts, and matches
// are all created at runtime by the agent pipeline + reciprocal matching, so
// no static seed data is needed (and seeding caused dummy URLs to leak into
// the saved-알림 list before).
export const MOCK_INTERESTS: Interest[] = [];
export const MOCK_ALERTS: Alert[] = [];
export const MOCK_MATCHES: Match[] = [];
