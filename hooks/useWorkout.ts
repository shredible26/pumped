import { useWorkoutStore } from '@/stores/workoutStore';

export function useWorkout() {
  const store = useWorkoutStore();
  return store;
}
