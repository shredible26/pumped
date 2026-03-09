import { useProfileStore } from '@/stores/profileStore';

export function useStreak() {
  const { profile } = useProfileStore();

  return {
    streak: profile?.current_streak_days ?? 0,
    longestStreak: profile?.longest_streak_days ?? 0,
  };
}
