import type { PlanTier } from '@/lib/agents/ApiClient';

const PLAN_INTEREST_CAP: Record<PlanTier, number> = {
  free: 3,
  basic: 5,
  pro: 15,
  power: 30,
};

export function planInterestCap(plan: PlanTier | string | undefined | null): number {
  const p = (plan as PlanTier) ?? 'free';
  return PLAN_INTEREST_CAP[p] ?? PLAN_INTEREST_CAP.free;
}
