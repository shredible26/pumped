import { differenceInCalendarDays } from 'date-fns';
import { supabase } from './supabase';
import { e1rm } from '@/utils/epley';
import { getLocalDateString, parseLocalDate } from '@/utils/date';

interface SessionRow {
  id: string;
  date: string;
}

type Big3Lift = 'squat' | 'bench' | 'deadlift';

function calculateStreaks(dateStrings: string[]): {
  current_streak_days: number;
  longest_streak_days: number;
} {
  if (dateStrings.length === 0) {
    return {
      current_streak_days: 0,
      longest_streak_days: 0,
    };
  }

  const uniqueDates = [...new Set(dateStrings)].sort(
    (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime(),
  );

  let longest = 0;
  let running = 0;
  let previousDate: Date | null = null;

  for (const dateString of uniqueDates) {
    const currentDate = parseLocalDate(dateString);
    if (
      previousDate &&
      differenceInCalendarDays(currentDate, previousDate) === 1
    ) {
      running += 1;
    } else {
      running = 1;
    }

    longest = Math.max(longest, running);
    previousDate = currentDate;
  }

  const latestDateString = uniqueDates[uniqueDates.length - 1];
  const today = getLocalDateString();
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

  if (latestDateString !== today && latestDateString !== yesterday) {
    return {
      current_streak_days: 0,
      longest_streak_days: longest,
    };
  }

  let current = 1;
  let checkDate = parseLocalDate(latestDateString);

  for (let index = uniqueDates.length - 2; index >= 0; index -= 1) {
    const expectedDate = new Date(checkDate);
    expectedDate.setDate(expectedDate.getDate() - 1);

    const dateString = uniqueDates[index];
    if (differenceInCalendarDays(parseLocalDate(dateString), expectedDate) === 0) {
      current += 1;
      checkDate = parseLocalDate(dateString);
      continue;
    }
    break;
  }

  return {
    current_streak_days: current,
    longest_streak_days: longest,
  };
}

async function calculateLoggedBigThree(sessionIds: string[]): Promise<Record<Big3Lift, number>> {
  if (sessionIds.length === 0) {
    return {
      squat: 0,
      bench: 0,
      deadlift: 0,
    };
  }

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, big_three_type')
    .or('big_three_type.eq.squat,big_three_type.eq.bench,big_three_type.eq.deadlift');

  const liftIds = new Map<Big3Lift, Set<string>>([
    ['squat', new Set<string>()],
    ['bench', new Set<string>()],
    ['deadlift', new Set<string>()],
  ]);

  for (const exercise of exercises ?? []) {
    const lift = exercise.big_three_type as Big3Lift | null;
    if (!lift) continue;
    liftIds.get(lift)?.add(exercise.id);
  }

  const { data: setLogs } = await supabase
    .from('set_logs')
    .select('exercise_id, actual_weight, actual_reps')
    .in('session_id', sessionIds)
    .not('actual_weight', 'is', null)
    .not('actual_reps', 'is', null);

  const best: Record<Big3Lift, number> = {
    squat: 0,
    bench: 0,
    deadlift: 0,
  };

  for (const setLog of setLogs ?? []) {
    const exerciseId = setLog.exercise_id as string | null;
    if (!exerciseId) continue;

    const weight = Number(setLog.actual_weight) || 0;
    const reps = Number(setLog.actual_reps) || 0;
    if (weight <= 0 || reps <= 0) continue;

    const estimated = e1rm(weight, reps);
    for (const lift of ['squat', 'bench', 'deadlift'] as Big3Lift[]) {
      if (!liftIds.get(lift)?.has(exerciseId)) continue;
      if (estimated > best[lift]) {
        best[lift] = estimated;
      }
    }
  }

  return best;
}

export async function recalculateProfileMetrics(userId: string) {
  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('id, date')
    .eq('user_id', userId)
    .eq('completed', true)
    .or('is_rest_day.is.null,is_rest_day.eq.false')
    .order('date', { ascending: true });

  if (error) throw error;

  const sessionRows = (sessions ?? []) as SessionRow[];
  const streaks = calculateStreaks(sessionRows.map((session) => session.date));
  const bigThree = await calculateLoggedBigThree(sessionRows.map((session) => session.id));
  const strengthScore = bigThree.squat + bigThree.bench + bigThree.deadlift;

  const updates = {
    total_workouts: sessionRows.length,
    current_streak_days: streaks.current_streak_days,
    longest_streak_days: streaks.longest_streak_days,
    squat_e1rm: bigThree.squat,
    bench_e1rm: bigThree.bench,
    deadlift_e1rm: bigThree.deadlift,
    strength_score: strengthScore,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (updateError) throw updateError;
  return updatedProfile;
}
