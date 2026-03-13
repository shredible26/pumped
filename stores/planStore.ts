import { create } from 'zustand';
import type { GeneratedWorkout } from '@/services/ai';

interface StoredPlan {
  userId: string;
  planDate: string;
  plan: GeneratedWorkout;
}

interface PlanStoreState {
  todaysPlan: StoredPlan | null;
  setTodaysPlan: (userId: string, planDate: string, plan: GeneratedWorkout) => void;
  clearTodaysPlan: (userId?: string) => void;
}

export const usePlanStore = create<PlanStoreState>((set) => ({
  todaysPlan: null,
  setTodaysPlan: (userId, planDate, plan) =>
    set({
      todaysPlan: {
        userId,
        planDate,
        plan,
      },
    }),
  clearTodaysPlan: (userId) =>
    set((state) => {
      if (!state.todaysPlan) return state;
      if (userId && state.todaysPlan.userId !== userId) return state;
      return { todaysPlan: null };
    }),
}));

export function getStoredTodaysPlan(
  userId: string,
  planDate: string,
): GeneratedWorkout | null {
  const stored = usePlanStore.getState().todaysPlan;
  if (!stored) return null;
  if (stored.userId !== userId || stored.planDate !== planDate) return null;
  return stored.plan;
}
