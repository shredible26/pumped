import { useProfileStore } from '@/stores/profileStore';

export function useStrength() {
  const { profile } = useProfileStore();

  return {
    score: profile?.strength_score ?? 0,
    squat: profile?.squat_e1rm ?? 0,
    bench: profile?.bench_e1rm ?? 0,
    deadlift: profile?.deadlift_e1rm ?? 0,
  };
}
