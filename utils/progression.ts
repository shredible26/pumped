import { SetLog } from '@/types/workout';

export function getProgression(
  _exerciseId: string,
  recentSets: SetLog[],
): { weight: number; reps: string; reason: string } {
  if (recentSets.length === 0) {
    return { weight: 0, reps: '8-10', reason: 'No history. Start light.' };
  }

  const lastSession = recentSets.filter((s) => s.completed && !s.is_warmup);
  const allRepsHit = lastSession.every(
    (s) => s.actual_reps != null && s.target_reps != null && s.actual_reps >= s.target_reps,
  );
  const lastWeight = lastSession[0]?.actual_weight || 0;

  if (allRepsHit) {
    const bump = lastWeight >= 100 ? 5 : 2.5;
    return {
      weight: lastWeight + bump,
      reps: `${lastSession[0].target_reps}`,
      reason: `You hit all target reps last time. Adding ${bump} lbs.`,
    };
  }

  return {
    weight: lastWeight,
    reps: `${lastSession[0].target_reps}`,
    reason: 'Working to hit all target reps before increasing weight.',
  };
}
