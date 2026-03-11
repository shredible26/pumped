import { supabase } from './supabase';
import { fetchFatigueMap } from './fatigue';
import { subDays, startOfDay } from 'date-fns';

export interface Insight {
  icon: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'suggestion';
}

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  lats: 'Lats',
  traps: 'Traps',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

export async function generateInsights(userId: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, date, name, total_volume, is_rest_day')
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('is_rest_day', false)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (!sessions || sessions.length < 5) return insights;

  const { data: sets } = await supabase
    .from('set_logs')
    .select('session_id, exercise_id, actual_weight, actual_reps')
    .in('session_id', sessions.map((s) => s.id));

  const exerciseIds = [...new Set((sets || []).map((s: any) => s.exercise_id).filter(Boolean))];
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, primary_muscle, name')
    .in('id', exerciseIds);
  const exMap = new Map((exercises || []).map((e: any) => [e.id, e]));

  const muscleVolume = new Map<string, number>();
  let totalVolume = 0;
  const pushMuscles = new Set(['chest', 'front_delts', 'side_delts', 'triceps']);
  const pullMuscles = new Set(['rear_delts', 'lats', 'traps', 'biceps']);

  for (const set of sets || []) {
    const w = Number((set as any).actual_weight) || 0;
    const r = Number((set as any).actual_reps) || 0;
    const vol = w * r;
    if (vol <= 0) continue;
    const ex = exMap.get((set as any).exercise_id);
    const primary = ex?.primary_muscle?.toLowerCase?.();
    if (primary) {
      muscleVolume.set(primary, (muscleVolume.get(primary) ?? 0) + vol);
      totalVolume += vol;
    }
  }

  const workoutDays = new Set((sessions as any[]).filter((s) => !s.is_rest_day).map((s) => s.date));
  const workoutsPerWeek = workoutDays.size / 4.3;

  const { data: profile } = await supabase
    .from('profiles')
    .select('training_frequency, current_streak_days')
    .eq('id', userId)
    .single();

  const targetDays = (profile as any)?.training_frequency ?? 4;
  const streak = (profile as any)?.current_streak_days ?? 0;

  if (totalVolume > 0 && muscleVolume.size > 0) {
    const sorted = [...muscleVolume.entries()].sort((a, b) => b[1] - a[1]);
    const most = sorted[0];
    const mostPct = Math.round((most[1] / totalVolume) * 100);
    const mostLabel = MUSCLE_LABELS[most[0]] || most[0];
    insights.push({
      icon: '💪',
      title: 'Most trained muscle',
      description: `${mostLabel} is your most trained muscle this month (${mostPct}% of total volume).`,
      type: 'positive',
    });

    const least = sorted[sorted.length - 1];
    const leastPct = Math.round((least[1] / totalVolume) * 100);
    const leastLabel = MUSCLE_LABELS[least[0]] || least[0];
    if (leastPct < 8) {
      insights.push({
        icon: '📌',
        title: 'Least trained',
        description: `Your ${leastLabel.toLowerCase()} have only received ${leastPct}% of your volume. Consider adding more work.`,
        type: 'suggestion',
      });
    }
  }

  if (totalVolume > 0) {
    let pushVol = 0;
    let pullVol = 0;
    for (const [m, vol] of muscleVolume) {
      if (pushMuscles.has(m)) pushVol += vol;
      if (pullMuscles.has(m)) pullVol += vol;
    }
    if (pullVol > 0 && pushVol / pullVol >= 1.4) {
      const pct = Math.round(((pushVol - pullVol) / pullVol) * 100);
      insights.push({
        icon: '⚠️',
        title: 'Push/Pull imbalance',
        description: `You're doing ${pct}% more push than pull volume. Add more rows and pull-ups to avoid rounded shoulders.`,
        type: 'warning',
      });
    }
  }

  const avgWorkouts = Math.round(workoutsPerWeek * 10) / 10;
  if (avgWorkouts > targetDays) {
    insights.push({
      icon: '🔥',
      title: 'Consistency',
      description: `You've averaged ${avgWorkouts} workouts per week this month — above your target of ${targetDays}.`,
      type: 'positive',
    });
  } else if (avgWorkouts < targetDays && avgWorkouts > 0) {
    insights.push({
      icon: '📊',
      title: 'Consistency',
      description: `You've averaged ${avgWorkouts} workouts per week — below your target of ${targetDays}. Small steps count.`,
      type: 'suggestion',
    });
  } else if (avgWorkouts === targetDays) {
    insights.push({
      icon: '✅',
      title: 'Consistency',
      description: `You've averaged ${avgWorkouts} workouts per week — right on your target of ${targetDays}.`,
      type: 'positive',
    });
  }

  if (streak > 7) {
    insights.push({
      icon: '🔥',
      title: 'Streak',
      description: `You're on a ${streak} day streak — that's dedication. Keep it going.`,
      type: 'positive',
    });
  }

  try {
    const fatigueMap = await fetchFatigueMap(userId);
    const lowRecovery = fatigueMap.find(
      (f) => f.recovery_pct != null && f.recovery_pct < 20
    );
    if (lowRecovery) {
      const label = MUSCLE_LABELS[lowRecovery.muscle_group] || lowRecovery.muscle_group;
      insights.push({
        icon: '🛑',
        title: 'Recovery',
        description: `Your ${label.toLowerCase()} are only ${lowRecovery.recovery_pct}% recovered. Consider a rest day or upper body focus tomorrow.`,
        type: 'warning',
      });
    }
  } catch {
    // ignore
  }

  return insights.slice(0, 6);
}

/** Example exercises per muscle group for personalized suggestions */
const EXERCISE_SUGGESTIONS_BY_MUSCLE: Record<string, string> = {
  chest: 'bench press, incline dumbbell press, push-ups, cable flyes',
  front_delts: 'overhead press, front raises, push press',
  side_delts: 'lateral raises, upright rows, face pulls (rear/side)',
  rear_delts: 'face pulls, reverse flyes, bent-over lateral raises',
  lats: 'lat pulldowns, bent-over rows, pull-ups, single-arm rows',
  traps: 'shrugs, face pulls, upright rows, rack pulls',
  biceps: 'barbell curls, hammer curls, preacher curls, chin-ups',
  triceps: 'tricep pushdowns, overhead extensions, close-grip bench, dips',
  forearms: 'wrist curls, reverse curls, farmer carries',
  abs: 'planks, cable crunches, leg raises, dead bugs',
  quads: 'squats, leg press, lunges, leg extensions',
  hamstrings: 'Romanian deadlifts, leg curls, good mornings',
  glutes: 'hip thrusts, glute bridge, sumo squats, kickbacks',
  calves: 'calf raises, seated calf raises, jump rope',
};

/**
 * Generate 3–5 detailed, personalized suggestions (numeric bullet points) using user and progress data.
 */
export async function generateSuggestions(userId: string): Promise<string[]> {
  const suggestions: string[] = [];
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);

  const { data: profile } = await supabase
    .from('profiles')
    .select('training_frequency, current_streak_days')
    .eq('id', userId)
    .single();

  const targetDays = (profile as any)?.training_frequency ?? 4;
  const streak = (profile as any)?.current_streak_days ?? 0;

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, date, is_rest_day')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

  if (!sessions || sessions.length < 3) {
    suggestions.push('Log a few more workouts to unlock personalized suggestions based on your volume and muscle distribution.');
    return suggestions;
  }

  const { data: sets } = await supabase
    .from('set_logs')
    .select('session_id, exercise_id, actual_weight, actual_reps')
    .in('session_id', sessions.map((s) => s.id));
  const exerciseIds = [...new Set((sets || []).map((s: any) => s.exercise_id).filter(Boolean))];
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, primary_muscle')
    .in('id', exerciseIds);
  const exMap = new Map((exercises || []).map((e: any) => [e.id, e]));

  const muscleVolume = new Map<string, number>();
  let totalVol = 0;
  const pushMuscles = new Set(['chest', 'front_delts', 'side_delts', 'triceps']);
  const pullMuscles = new Set(['rear_delts', 'lats', 'traps', 'biceps']);

  for (const set of sets || []) {
    const w = Number((set as any).actual_weight) || 0;
    const r = Number((set as any).actual_reps) || 0;
    const vol = w * r;
    if (vol <= 0) continue;
    const ex = exMap.get((set as any).exercise_id);
    const primary = ex?.primary_muscle?.toLowerCase?.();
    if (primary) {
      muscleVolume.set(primary, (muscleVolume.get(primary) ?? 0) + vol);
      totalVol += vol;
    }
  }

  const workoutDates = new Set((sessions as any[]).filter((s) => !s.is_rest_day).map((s) => s.date));
  const avgPerWeek = workoutDates.size / 4.3;

  if (avgPerWeek < targetDays) {
    suggestions.push(
      `Based on your Progress data, you're averaging ${avgPerWeek.toFixed(1)} workouts per week this month while your target is ${targetDays}. Try scheduling your next session for today or tomorrow to close the gap.`
    );
  }
  if (streak >= 3 && streak < 7) {
    suggestions.push(
      `You're on a ${streak}-day streak — one more day and you'll hit a full week. Plan a short session or log a rest day to keep the streak alive.`
    );
  }
  if (streak === 0 && workoutDates.size > 0) {
    suggestions.push(
      'Your streak has reset. Log a workout or rest day today to start a new streak and keep your consistency visible on the Today tab.'
    );
  }

  try {
    const fatigueMap = await fetchFatigueMap(userId);
    const low = fatigueMap.filter((f) => f.recovery_pct != null && f.recovery_pct < 30);
    if (low.length > 0) {
      const names = low.map((f) => MUSCLE_LABELS[f.muscle_group] || f.muscle_group).join(', ');
      suggestions.push(
        `Your Muscle Readiness data shows these muscles under 30% recovered: ${names}. Consider a rest day, or focus your next workout on other muscle groups to let these recover.`
      );
    }
  } catch {
    // ignore
  }

  if (totalVol > 0) {
    let pushVol = 0;
    let pullVol = 0;
    for (const [m, vol] of muscleVolume) {
      if (pushMuscles.has(m)) pushVol += vol;
      if (pullMuscles.has(m)) pullVol += vol;
    }
    if (pullVol > 0 && pushVol / pullVol >= 1.3) {
      const pct = Math.round(((pushVol - pullVol) / pullVol) * 100);
      suggestions.push(
        `Your volume distribution is ${pct}% more push than pull this month. To balance and support shoulder health, add more pulling work — for example lat pulldowns, bent-over rows, face pulls, and pull-ups.`
      );
    }
  }

  const sorted = [...muscleVolume.entries()].sort((a, b) => a[1] - b[1]);
  if (sorted.length >= 1) {
    const [leastKey, leastVol] = sorted[0];
    const leastLabel = MUSCLE_LABELS[leastKey] || leastKey;
    const leastPct = totalVol > 0 ? Math.round((leastVol / totalVol) * 100) : 0;
    const exerciseExamples = EXERCISE_SUGGESTIONS_BY_MUSCLE[leastKey];
    suggestions.push(
      `Your least trained muscle group this month is ${leastLabel} (${leastPct}% of volume). Consider adding exercises like ${exerciseExamples || 'targeted movements for this area'} to improve balance.`
    );
  }
  if (sorted.length >= 2) {
    const [secondKey] = sorted[1];
    const secondLabel = MUSCLE_LABELS[secondKey] || secondKey;
    const examples = EXERCISE_SUGGESTIONS_BY_MUSCLE[secondKey];
    if (examples && !suggestions.some((s) => s.includes(secondLabel))) {
      suggestions.push(
        `${secondLabel} is also getting relatively low volume. Try incorporating ${examples} into your next few sessions.`
      );
    }
  }

  return suggestions.slice(0, 5);
}
