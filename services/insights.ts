import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import type { EquipmentAccess, ExperienceLevel, ProgramStyle } from '@/types/user';
import { supabase } from './supabase';
import { fetchFatigueMap } from './fatigue';

export interface Insight {
  icon: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'suggestion';
}

export interface GenerateSuggestionsOptions {
  excludeSuggestions?: string[];
  variationSeed?: number;
  limit?: number;
}

export interface ProgressNarratives {
  insights: Insight[];
  suggestions: string[];
}

interface WorkoutSessionRow {
  id: string;
  date: string;
  name: string;
  total_volume: number | null;
  is_rest_day: boolean | null;
  is_cardio: boolean | null;
}

interface SetLogRow {
  session_id: string;
  exercise_id: string | null;
  actual_weight: number | null;
  actual_reps: number | null;
}

interface ExerciseRow {
  id: string;
  name: string;
  primary_muscle: string | null;
  secondary_muscles: string[] | null;
}

interface ProgressSnapshot {
  monthName: string;
  targetDays: number;
  streak: number;
  programStyle: ProgramStyle | null;
  equipmentAccess: EquipmentAccess | null;
  experienceLevel: ExperienceLevel | null;
  monthWorkoutCount: number;
  previousMonthWorkoutCount: number;
  workoutsThisWeek: number;
  workoutsRemainingThisWeek: number;
  daysRemainingThisWeek: number;
  avgWorkoutsPerWeek: number;
  totalLiftVolume: number;
  previousMonthLiftVolume: number;
  dominantMuscle: [string, number] | null;
  dominantMusclePct: number;
  leastMuscles: Array<[string, number]>;
  musclePctByKey: Map<string, number>;
  pushVolume: number;
  pullVolume: number;
  lowRecoveryMuscles: Array<{ label: string; recovery_pct: number }>;
}

interface SuggestionCandidate {
  id: string;
  priority: number;
  text: string;
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

const PUSH_MUSCLES = new Set(['chest', 'front_delts', 'side_delts', 'triceps']);
const PULL_MUSCLES = new Set(['rear_delts', 'lats', 'traps', 'biceps']);
const LOWER_BODY_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'calves']);

const EXERCISE_SUGGESTIONS_BY_MUSCLE: Record<
  string,
  Record<EquipmentAccess, string>
> = {
  chest: {
    full_gym: 'bench press, incline dumbbell press, and cable flyes',
    home_gym: 'dumbbell floor press, incline dumbbell press, and push-ups',
    bodyweight: 'push-ups, deficit push-ups, and tempo push-ups',
  },
  front_delts: {
    full_gym: 'overhead press, machine shoulder press, and front raises',
    home_gym: 'dumbbell overhead press, Arnold press, and pike push-ups',
    bodyweight: 'pike push-ups, handstand push-up progressions, and slow eccentrics',
  },
  side_delts: {
    full_gym: 'dumbbell lateral raises, cable laterals, and upright rows',
    home_gym: 'dumbbell lateral raises, leaning lateral raises, and high pulls',
    bodyweight: 'pike push-up progressions plus slow overhead holds',
  },
  rear_delts: {
    full_gym: 'face pulls, reverse pec-deck, and reverse cable flyes',
    home_gym: 'rear-delt flyes, chest-supported reverse flyes, and band pull-aparts',
    bodyweight: 'prone YTWs, wall slides, and reverse snow angels',
  },
  lats: {
    full_gym: 'lat pulldowns, chest-supported rows, and pull-ups',
    home_gym: 'one-arm dumbbell rows, band pulldowns, and pull-ups',
    bodyweight: 'pull-ups, inverted rows, and towel rows',
  },
  traps: {
    full_gym: 'shrugs, face pulls, and rack pulls',
    home_gym: 'dumbbell shrugs, high pulls, and farmer carries',
    bodyweight: 'farmer carries and band face pulls',
  },
  biceps: {
    full_gym: 'EZ-bar curls, hammer curls, and preacher curls',
    home_gym: 'dumbbell curls, hammer curls, and chin-ups',
    bodyweight: 'chin-ups and towel curls',
  },
  triceps: {
    full_gym: 'cable pushdowns, overhead cable extensions, and dips',
    home_gym: 'dumbbell overhead extensions, close-grip push-ups, and bench dips',
    bodyweight: 'close-grip push-ups, bench dips, and diamond push-ups',
  },
  forearms: {
    full_gym: 'farmer carries, reverse curls, and wrist curls',
    home_gym: 'farmer carries, hammer curls, and wrist curls',
    bodyweight: 'dead hangs, towel hangs, and farmer carries',
  },
  abs: {
    full_gym: 'cable crunches, hanging leg raises, and ab-wheel rollouts',
    home_gym: 'weighted sit-ups, hanging leg raises, and ab-wheel rollouts',
    bodyweight: 'hollow holds, leg raises, and dead bugs',
  },
  quads: {
    full_gym: 'back squats, leg press, and leg extensions',
    home_gym: 'goblet squats, split squats, and step-ups',
    bodyweight: 'split squats, step-ups, and tempo squats',
  },
  hamstrings: {
    full_gym: 'Romanian deadlifts, seated leg curls, and good mornings',
    home_gym: 'Romanian deadlifts, sliding leg curls, and single-leg RDLs',
    bodyweight: 'sliding leg curls, single-leg hip hinges, and Nordic curl progressions',
  },
  glutes: {
    full_gym: 'hip thrusts, Bulgarian split squats, and cable kickbacks',
    home_gym: 'hip thrusts, Romanian deadlifts, and split squats',
    bodyweight: 'hip thrusts, lunges, and single-leg glute bridges',
  },
  calves: {
    full_gym: 'standing calf raises, seated calf raises, and sled pushes',
    home_gym: 'single-leg calf raises, donkey calf raises, and loaded carries',
    bodyweight: 'single-leg calf raises, pogo hops, and slow eccentrics',
  },
};

function labelMuscle(muscle: string): string {
  return MUSCLE_LABELS[muscle] ?? muscle;
}

function normalizeSuggestion(text: string): string {
  return text.trim().toLowerCase();
}

function hashSeed(seed: number): number {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash);
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function getExamplesForMuscle(
  muscle: string,
  equipmentAccess: EquipmentAccess | null,
): string {
  const access = equipmentAccess ?? 'full_gym';
  return (
    EXERCISE_SUGGESTIONS_BY_MUSCLE[muscle]?.[access] ??
    EXERCISE_SUGGESTIONS_BY_MUSCLE[muscle]?.full_gym ??
    'focused accessory work for that area'
  );
}

function getRecommendedSessionFocus(
  programStyle: ProgramStyle | null,
  leastMuscle: string | null,
): string {
  if (!leastMuscle) return 'full-body';
  if (programStyle === 'ppl') {
    if (LOWER_BODY_MUSCLES.has(leastMuscle)) return 'legs';
    if (PULL_MUSCLES.has(leastMuscle)) return 'pull';
    return 'push';
  }
  if (programStyle === 'upper_lower') {
    return LOWER_BODY_MUSCLES.has(leastMuscle) ? 'lower-body' : 'upper-body';
  }
  return `${labelMuscle(leastMuscle).toLowerCase()}-focused`;
}

function formatMuscleList(muscles: Array<{ label: string; recovery_pct: number }>): string {
  if (muscles.length === 1) return `${muscles[0].label} (${muscles[0].recovery_pct}%)`;
  if (muscles.length === 2) {
    return `${muscles[0].label} (${muscles[0].recovery_pct}%) and ${muscles[1].label} (${muscles[1].recovery_pct}%)`;
  }

  const lead = muscles
    .slice(0, -1)
    .map((muscle) => `${muscle.label} (${muscle.recovery_pct}%)`)
    .join(', ');
  const tail = muscles[muscles.length - 1];
  return `${lead}, and ${tail.label} (${tail.recovery_pct}%)`;
}

function buildInsights(snapshot: ProgressSnapshot): Insight[] {
  const insights: Insight[] = [];
  const avgPerWeek = snapshot.avgWorkoutsPerWeek.toFixed(1);
  const monthWorkoutDelta = snapshot.monthWorkoutCount - snapshot.previousMonthWorkoutCount;

  insights.push({
    icon: '📅',
    title: 'Monthly pace',
    description:
      `${snapshot.monthName}: ${snapshot.monthWorkoutCount} workout` +
      `${snapshot.monthWorkoutCount === 1 ? '' : 's'} logged so far, averaging ${avgPerWeek} per week ` +
      `against your ${snapshot.targetDays}/week target.`,
    type: snapshot.avgWorkoutsPerWeek >= snapshot.targetDays ? 'positive' : 'suggestion',
  });

  if (snapshot.previousMonthWorkoutCount > 0) {
    insights.push({
      icon: monthWorkoutDelta > 0 ? '📈' : monthWorkoutDelta < 0 ? '📉' : '📊',
      title: 'Month over month',
      description: monthWorkoutDelta === 0
        ? `You're matching last month's pace exactly (${snapshot.monthWorkoutCount} workouts this month and last month).`
        : `${Math.abs(monthWorkoutDelta)} workout${Math.abs(monthWorkoutDelta) === 1 ? '' : 's'} ` +
          `${monthWorkoutDelta > 0 ? 'up' : 'down'} versus last month ` +
          `(${snapshot.monthWorkoutCount} this month vs ${snapshot.previousMonthWorkoutCount} last month).`,
      type: monthWorkoutDelta > 0 ? 'positive' : monthWorkoutDelta < 0 ? 'warning' : 'positive',
    });
  }

  if (snapshot.dominantMuscle && snapshot.dominantMusclePct > 0) {
    insights.push({
      icon: '💪',
      title: 'Most trained muscle',
      description:
        `${labelMuscle(snapshot.dominantMuscle[0])} is leading your lifting volume this month ` +
        `at ${snapshot.dominantMusclePct}% of your tracked volume.`,
      type: 'positive',
    });
  }

  const leastMuscle = snapshot.leastMuscles[0];
  if (leastMuscle) {
    const leastPct = snapshot.musclePctByKey.get(leastMuscle[0]) ?? 0;
    if (leastPct <= 8) {
      insights.push({
        icon: '📌',
        title: 'Lowest exposure',
        description:
          `${labelMuscle(leastMuscle[0])} is only ${leastPct}% of your tracked lifting volume this month.`,
        type: 'suggestion',
      });
    }
  }

  if (snapshot.pullVolume > 0 && snapshot.pushVolume / snapshot.pullVolume >= 1.25) {
    const diffPct = Math.round(((snapshot.pushVolume - snapshot.pullVolume) / snapshot.pullVolume) * 100);
    insights.push({
      icon: '⚠️',
      title: 'Push/Pull balance',
      description: `You're doing about ${diffPct}% more push than pull volume this month.`,
      type: 'warning',
    });
  }

  if (snapshot.lowRecoveryMuscles.length > 0) {
    insights.push({
      icon: '🛑',
      title: 'Recovery watch',
      description: `${formatMuscleList(snapshot.lowRecoveryMuscles.slice(0, 2))} are still low on readiness.`,
      type: 'warning',
    });
  }

  if (snapshot.streak > 0) {
    insights.push({
      icon: '🔥',
      title: 'Current streak',
      description: `You're on a ${snapshot.streak}-day streak right now.`,
      type: 'positive',
    });
  }

  return insights.slice(0, 6);
}

function buildSuggestionCandidates(snapshot: ProgressSnapshot): SuggestionCandidate[] {
  const candidates: SuggestionCandidate[] = [];
  const leastMuscle = snapshot.leastMuscles[0]?.[0] ?? null;
  const secondLeastMuscle = snapshot.leastMuscles[1]?.[0] ?? null;
  const leastPct = leastMuscle ? snapshot.musclePctByKey.get(leastMuscle) ?? 0 : 0;
  const secondLeastPct = secondLeastMuscle
    ? snapshot.musclePctByKey.get(secondLeastMuscle) ?? 0
    : 0;
  const focusLabel = getRecommendedSessionFocus(snapshot.programStyle, leastMuscle);
  const workoutsNeededThisWeek = Math.max(
    0,
    snapshot.targetDays - snapshot.workoutsThisWeek,
  );
  const volumeDeltaPct = pctChange(snapshot.totalLiftVolume, snapshot.previousMonthLiftVolume);

  if (snapshot.monthWorkoutCount === 0) {
    candidates.push({
      id: 'month-start',
      priority: 100,
      text:
        `You have no workouts logged in ${snapshot.monthName} yet. Schedule a ${focusLabel} session next ` +
        `so your month starts moving again.`,
    });
  }

  if (snapshot.avgWorkoutsPerWeek < snapshot.targetDays) {
    candidates.push({
      id: 'consistency-gap',
      priority: 95,
      text:
        `You have ${snapshot.monthWorkoutCount} workouts logged in ${snapshot.monthName}, averaging ` +
        `${snapshot.avgWorkoutsPerWeek.toFixed(1)} per week against your ${snapshot.targetDays}/week target. ` +
        `Add ${
          workoutsNeededThisWeek > 1
            ? `${workoutsNeededThisWeek} sessions`
            : workoutsNeededThisWeek === 1
              ? 'one more session'
              : 'at least one short session'
        } this week to close the gap.`,
    });
  } else {
    candidates.push({
      id: 'consistency-on-pace',
      priority: 70,
      text:
        `You're on pace with ${snapshot.monthWorkoutCount} workouts in ${snapshot.monthName}. ` +
        `Use your next ${focusLabel} session to add 2.5-5 lb or 1 rep to one anchor lift.`,
    });
  }

  if (snapshot.daysRemainingThisWeek <= 3 && workoutsNeededThisWeek > 0) {
    candidates.push({
      id: 'week-close',
      priority: 88,
      text:
        `You still need ${workoutsNeededThisWeek} workout${workoutsNeededThisWeek === 1 ? '' : 's'} ` +
        `to match your ${snapshot.targetDays}/week plan before the week ends. Keep the next session focused and under 60 minutes if time is tight.`,
    });
  }

  if (snapshot.lowRecoveryMuscles.length > 0) {
    candidates.push({
      id: 'recovery',
      priority: 93,
      text:
        `Your ${formatMuscleList(snapshot.lowRecoveryMuscles.slice(0, 2))} are still under 30% recovered. ` +
        `Keep your next workout away from hard ${snapshot.lowRecoveryMuscles[0].label.toLowerCase()} work until readiness improves.`,
    });
  }

  if (snapshot.pullVolume > 0 && snapshot.pushVolume / snapshot.pullVolume >= 1.25) {
    const diffPct = Math.round(((snapshot.pushVolume - snapshot.pullVolume) / snapshot.pullVolume) * 100);
    candidates.push({
      id: 'push-pull',
      priority: 92,
      text:
        `Your lifting volume is about ${diffPct}% more push than pull this month. ` +
        `Add 2-4 hard sets of rows, pulldowns, pull-ups, or face pulls to your next two sessions to rebalance it.`,
    });
  }

  if (leastMuscle && leastPct > 0) {
    candidates.push({
      id: 'least-muscle',
      priority: 91,
      text:
        `${labelMuscle(leastMuscle)} is your lowest-volume muscle group this month at ${leastPct}% of tracked lifting volume. ` +
        `Add 2-3 hard sets of ${getExamplesForMuscle(leastMuscle, snapshot.equipmentAccess)} in your next two workouts.`,
    });
  }

  if (secondLeastMuscle && secondLeastPct > 0 && secondLeastPct <= 12) {
    candidates.push({
      id: 'second-least-muscle',
      priority: 76,
      text:
        `${labelMuscle(secondLeastMuscle)} is also lagging at ${secondLeastPct}% of tracked lifting volume. ` +
        `Rotate in ${getExamplesForMuscle(secondLeastMuscle, snapshot.equipmentAccess)} once this week so it does not keep trailing.`,
    });
  }

  if (snapshot.previousMonthWorkoutCount > snapshot.monthWorkoutCount) {
    const delta = snapshot.previousMonthWorkoutCount - snapshot.monthWorkoutCount;
    candidates.push({
      id: 'month-behind',
      priority: 82,
      text:
        `You're ${delta} workout${delta === 1 ? '' : 's'} behind last month's pace. ` +
        `Shorten your next session if needed, but keep it on the calendar so consistency does not slip.`,
    });
  }

  if (volumeDeltaPct != null && volumeDeltaPct <= -15) {
    candidates.push({
      id: 'volume-down',
      priority: 78,
      text:
        `Your tracked lifting volume is ${Math.round(Math.abs(volumeDeltaPct))}% lower than last month. ` +
        `Bring back one extra working set on your first 2-3 exercises next session if recovery feels good.`,
    });
  }

  if (snapshot.streak > 0 && snapshot.streak < 7) {
    candidates.push({
      id: 'streak-build',
      priority: 74,
      text:
        `You're on a ${snapshot.streak}-day streak. Keep tomorrow planned now so you do not lose momentum.`,
    });
  }

  if (snapshot.experienceLevel === 'beginner') {
    candidates.push({
      id: 'beginner-execution',
      priority: 58,
      text:
        `Stay with simple progressions: keep 1-2 reps in reserve on most sets and add weight only after you hit every target rep cleanly.`,
    });
  } else {
    candidates.push({
      id: 'intermediate-execution',
      priority: 58,
      text:
        `Use one top set plus 1-2 back-off sets on your main lift next workout so you can push intensity without losing form quality.`,
    });
  }

  return candidates;
}

function selectSuggestions(
  candidates: SuggestionCandidate[],
  options?: GenerateSuggestionsOptions,
): string[] {
  const limit = options?.limit ?? 4;
  const deduped = Array.from(
    new Map(candidates.map((candidate) => [normalizeSuggestion(candidate.text), candidate])).values(),
  ).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  if (deduped.length === 0) {
    return ['Keep logging workouts to unlock more specific suggestions from your training data.'];
  }

  const excluded = new Set(
    (options?.excludeSuggestions ?? []).map((entry) => normalizeSuggestion(entry)),
  );
  const preferred = deduped.filter(
    (candidate) => !excluded.has(normalizeSuggestion(candidate.text)),
  );
  const pool = preferred.length >= limit ? preferred : deduped;

  if (options?.variationSeed != null && pool.length > limit) {
    const offset = hashSeed(options.variationSeed) % pool.length;
    const rotated = pool.slice(offset).concat(pool.slice(0, offset));
    return rotated.slice(0, limit).map((candidate) => candidate.text);
  }

  return pool.slice(0, limit).map((candidate) => candidate.text);
}

async function buildProgressSnapshot(userId: string): Promise<ProgressSnapshot> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const previousMonthDate = subMonths(now, 1);
  const previousMonthStart = startOfMonth(previousMonthDate);
  const previousMonthEnd = endOfMonth(previousMonthDate);
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
  const previousMonthStartStr = format(previousMonthStart, 'yyyy-MM-dd');
  const previousMonthEndStr = format(previousMonthEnd, 'yyyy-MM-dd');
  const currentWeekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
  const currentWeekEndStr = format(currentWeekEnd, 'yyyy-MM-dd');

  const [{ data: profile }, { data: sessions }, fatigueMap] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'training_frequency, current_streak_days, program_style, equipment_access, experience_level',
      )
      .eq('id', userId)
      .single(),
    supabase
      .from('workout_sessions')
      .select('id, date, name, total_volume, is_rest_day, is_cardio')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('date', previousMonthStartStr)
      .lte('date', monthEndStr)
      .order('date', { ascending: false }),
    fetchFatigueMap(userId).catch(() => []),
  ]);

  const targetDays = Number(profile?.training_frequency ?? 4);
  const streak = Number(profile?.current_streak_days ?? 0);
  const sessionRows = (sessions ?? []) as WorkoutSessionRow[];
  const workoutRows = sessionRows.filter((session) => !session.is_rest_day);
  const monthWorkouts = workoutRows.filter(
    (session) => session.date >= monthStartStr && session.date <= monthEndStr,
  );
  const previousMonthWorkouts = workoutRows.filter(
    (session) => session.date >= previousMonthStartStr && session.date <= previousMonthEndStr,
  );
  const workoutsThisWeek = workoutRows.filter(
    (session) => session.date >= currentWeekStartStr && session.date <= currentWeekEndStr,
  ).length;
  const elapsedWeeks = Math.max(now.getDate() / 7, 1);
  const avgWorkoutsPerWeek = monthWorkouts.length / elapsedWeeks;

  const monthSessionIds = monthWorkouts.map((session) => session.id);
  const previousMonthSessionIds = previousMonthWorkouts.map((session) => session.id);
  const allSessionIds = Array.from(new Set([...monthSessionIds, ...previousMonthSessionIds]));

  const monthSessionIdSet = new Set(monthSessionIds);
  const previousMonthSessionIdSet = new Set(previousMonthSessionIds);

  const muscleVolume = new Map<string, number>();
  const musclePctByKey = new Map<string, number>();
  let totalLiftVolume = 0;
  let previousMonthLiftVolume = 0;
  let muscleDistributionVolume = 0;
  let pushVolume = 0;
  let pullVolume = 0;

  if (allSessionIds.length > 0) {
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('session_id, exercise_id, actual_weight, actual_reps')
      .in('session_id', allSessionIds);

    const exerciseIds = Array.from(
      new Set(
        ((setLogs ?? []) as SetLogRow[])
          .map((setLog) => setLog.exercise_id)
          .filter((exerciseId): exerciseId is string => Boolean(exerciseId)),
      ),
    );

    const { data: exercises } =
      exerciseIds.length > 0
        ? await supabase
            .from('exercises')
            .select('id, name, primary_muscle, secondary_muscles')
            .in('id', exerciseIds)
        : { data: [] as ExerciseRow[] };

    const exerciseMap = new Map(
      ((exercises ?? []) as ExerciseRow[]).map((exercise) => [exercise.id, exercise]),
    );

    for (const setLog of (setLogs ?? []) as SetLogRow[]) {
      const weight = Number(setLog.actual_weight) || 0;
      const reps = Number(setLog.actual_reps) || 0;
      const setVolume = weight * reps;

      if (setVolume <= 0 || !setLog.exercise_id) continue;

      if (monthSessionIdSet.has(setLog.session_id)) {
        totalLiftVolume += setVolume;
      } else if (previousMonthSessionIdSet.has(setLog.session_id)) {
        previousMonthLiftVolume += setVolume;
      } else {
        continue;
      }

      if (!monthSessionIdSet.has(setLog.session_id)) continue;

      const exercise = exerciseMap.get(setLog.exercise_id);
      const primaryMuscle = exercise?.primary_muscle?.toLowerCase?.() ?? null;
      const secondaryMuscles = (exercise?.secondary_muscles ?? []).map((muscle) =>
        muscle.toLowerCase(),
      );

      if (primaryMuscle) {
        muscleVolume.set(primaryMuscle, (muscleVolume.get(primaryMuscle) ?? 0) + setVolume);
        muscleDistributionVolume += setVolume;
        if (PUSH_MUSCLES.has(primaryMuscle)) pushVolume += setVolume;
        if (PULL_MUSCLES.has(primaryMuscle)) pullVolume += setVolume;
      }

      for (const muscle of secondaryMuscles) {
        if (!muscle || muscle === primaryMuscle) continue;
        const contribution = setVolume * 0.5;
        muscleVolume.set(muscle, (muscleVolume.get(muscle) ?? 0) + contribution);
        muscleDistributionVolume += contribution;
        if (PUSH_MUSCLES.has(muscle)) pushVolume += contribution;
        if (PULL_MUSCLES.has(muscle)) pullVolume += contribution;
      }
    }
  }

  const sortedMuscles = [...muscleVolume.entries()].sort((a, b) => a[1] - b[1]);
  const dominantMuscle =
    sortedMuscles.length > 0 ? sortedMuscles[sortedMuscles.length - 1] : null;

  if (muscleDistributionVolume > 0) {
    for (const [muscle, volume] of muscleVolume) {
      musclePctByKey.set(muscle, Math.round((volume / muscleDistributionVolume) * 100));
    }
  }

  const lowRecoveryMuscles = (fatigueMap ?? [])
    .filter(
      (entry) =>
        entry.recovery_pct != null &&
        Number(entry.recovery_pct) < 30,
    )
    .sort((a, b) => Number(a.recovery_pct) - Number(b.recovery_pct))
    .map((entry) => ({
      label: labelMuscle(entry.muscle_group),
      recovery_pct: Number(entry.recovery_pct),
    }));

  return {
    monthName: format(now, 'MMMM'),
    targetDays,
    streak,
    programStyle: (profile?.program_style as ProgramStyle | null) ?? null,
    equipmentAccess: (profile?.equipment_access as EquipmentAccess | null) ?? null,
    experienceLevel: (profile?.experience_level as ExperienceLevel | null) ?? null,
    monthWorkoutCount: monthWorkouts.length,
    previousMonthWorkoutCount: previousMonthWorkouts.length,
    workoutsThisWeek,
    workoutsRemainingThisWeek: Math.max(0, targetDays - workoutsThisWeek),
    daysRemainingThisWeek: Math.max(0, differenceInCalendarDays(currentWeekEnd, now)),
    avgWorkoutsPerWeek,
    totalLiftVolume,
    previousMonthLiftVolume,
    dominantMuscle,
    dominantMusclePct: dominantMuscle
      ? musclePctByKey.get(dominantMuscle[0]) ?? 0
      : 0,
    leastMuscles: sortedMuscles.slice(0, 2),
    musclePctByKey,
    pushVolume,
    pullVolume,
    lowRecoveryMuscles,
  };
}

export async function getProgressNarratives(
  userId: string,
  options?: GenerateSuggestionsOptions,
): Promise<ProgressNarratives> {
  const snapshot = await buildProgressSnapshot(userId);
  return {
    insights: buildInsights(snapshot),
    suggestions: selectSuggestions(buildSuggestionCandidates(snapshot), options),
  };
}

export async function generateInsights(userId: string): Promise<Insight[]> {
  return (await getProgressNarratives(userId)).insights;
}

export async function generateSuggestions(
  userId: string,
  options?: GenerateSuggestionsOptions,
): Promise<string[]> {
  return (await getProgressNarratives(userId, options)).suggestions;
}
