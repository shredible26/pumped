export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export function strengthScore(squat: number, bench: number, deadlift: number): number {
  return squat + bench + deadlift;
}
