import { supabase } from './supabase';
import { e1rm } from '@/utils/epley';
import {
  fetchAllPaginatedRows,
  fetchAllPaginatedRowsForValues,
} from '@/utils/supabasePagination';

interface CompletedSession {
  id: string;
  name: string;
  date: string;
  completed_at: string | null;
}

interface ExerciseMeta {
  id: string;
  name: string;
  equipment: string;
  movement_pattern: string;
}

export interface StrengthTrendExerciseOption {
  exerciseId: string;
  exerciseName: string;
  sessionCount: number;
  lastLoggedDate: string | null;
  lastWorkoutName: string | null;
  latestWeight: number | null;
}

export interface StrengthTrendPoint {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  completedAt: string;
  maxWeight: number;
  reps: number | null;
  estimatedOneRepMax: number | null;
  setCount: number;
}

export interface StrengthTrendBestMark {
  value: number;
  weight: number;
  reps: number | null;
  sessionId: string;
  sessionName: string;
  sessionDate: string;
}

export interface StrengthTrendPeerComparison {
  participantCount: number;
  strongerUserCount: number;
  rank: number | null;
  betterThanPercent: number | null;
}

export interface StrengthTrendData {
  exerciseId: string;
  exerciseName: string;
  points: StrengthTrendPoint[];
  actualMax: StrengthTrendBestMark | null;
  estimatedOneRepMax: StrengthTrendBestMark | null;
  peerComparison: StrengthTrendPeerComparison | null;
}

function isEligibleWeightedExercise(exercise: ExerciseMeta | undefined): boolean {
  if (!exercise) return false;
  if (exercise.equipment === 'bodyweight' || exercise.equipment === 'cardio_machine') return false;
  if (exercise.movement_pattern === 'cardio') return false;
  return true;
}

async function getCompletedSessions(userId: string): Promise<CompletedSession[]> {
  return fetchAllPaginatedRows<CompletedSession>((from, to) =>
    supabase
      .from('workout_sessions')
      .select('id, name, date, completed_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .or('is_rest_day.is.null,is_rest_day.eq.false')
      .order('completed_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );
}

async function getExerciseMeta(exerciseIds: string[]): Promise<Map<string, ExerciseMeta>> {
  if (exerciseIds.length === 0) return new Map();

  const exercises = await fetchAllPaginatedRowsForValues<ExerciseMeta, string>(
    exerciseIds,
    (chunk, from, to) =>
      supabase
        .from('exercises')
        .select('id, name, equipment, movement_pattern')
        .in('id', chunk)
        .order('id', { ascending: true })
        .range(from, to),
  );

  return new Map(exercises.map((exercise) => [exercise.id, exercise]));
}

async function getStrengthTrendPeerComparison(
  exerciseId: string,
): Promise<StrengthTrendPeerComparison | null> {
  const { data, error } = await supabase.rpc('get_exercise_strength_percentile', {
    target_exercise_id: exerciseId,
  });

  if (error) {
    console.warn('Strength percentile fetch error', error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    participantCount: Number(row.participant_count) || 0,
    strongerUserCount: Number(row.stronger_user_count) || 0,
    rank: row.user_rank == null ? null : Number(row.user_rank) || null,
    betterThanPercent:
      row.better_than_pct == null ? null : Number(row.better_than_pct) || 0,
  };
}

export async function getStrengthTrendExerciseOptions(
  userId: string,
): Promise<StrengthTrendExerciseOption[]> {
  const sessions = await getCompletedSessions(userId);
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((session) => session.id);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  const setLogs = await fetchAllPaginatedRowsForValues<{
    session_id: string;
    exercise_id: string | null;
    actual_weight: number | null;
  }, string>(sessionIds, (chunk, from, to) =>
    supabase
      .from('set_logs')
      .select('id, session_id, exercise_id, actual_weight')
      .in('session_id', chunk)
      .gt('actual_weight', 0)
      .order('id', { ascending: true })
      .range(from, to),
  );

  const exerciseIds = [
    ...new Set(
      setLogs
        .map((set) => set.exercise_id)
        .filter((exerciseId): exerciseId is string => Boolean(exerciseId)),
    ),
  ];
  const exerciseMap = await getExerciseMeta(exerciseIds);

  const byExercise = new Map<
    string,
    {
      exerciseName: string;
      sessionIds: Set<string>;
      lastLoggedDate: string | null;
      lastWorkoutName: string | null;
      latestWeight: number | null;
    }
  >();

  for (const set of setLogs) {
    if (!set.exercise_id) continue;
    const exercise = exerciseMap.get(set.exercise_id);
    const session = sessionById.get(set.session_id);

    if (!exercise || !session || !isEligibleWeightedExercise(exercise)) continue;

    const weight = Number(set.actual_weight) || 0;
    if (weight <= 0) continue;

    const entry = byExercise.get(set.exercise_id) ?? {
      exerciseName: exercise.name,
      sessionIds: new Set<string>(),
      lastLoggedDate: null,
      lastWorkoutName: null,
      latestWeight: null,
    };

    entry.sessionIds.add(session.id);

    if (!entry.lastLoggedDate || session.date > entry.lastLoggedDate) {
      entry.lastLoggedDate = session.date;
      entry.lastWorkoutName = session.name;
      entry.latestWeight = weight;
    } else if (session.date === entry.lastLoggedDate) {
      entry.latestWeight = Math.max(entry.latestWeight ?? 0, weight);
    }

    byExercise.set(set.exercise_id, entry);
  }

  return Array.from(byExercise.entries())
    .map(([exerciseId, entry]) => ({
      exerciseId,
      exerciseName: entry.exerciseName,
      sessionCount: entry.sessionIds.size,
      lastLoggedDate: entry.lastLoggedDate,
      lastWorkoutName: entry.lastWorkoutName,
      latestWeight: entry.latestWeight,
    }))
    .sort((a, b) => {
      const dateCompare = (b.lastLoggedDate ?? '').localeCompare(a.lastLoggedDate ?? '');
      if (dateCompare !== 0) return dateCompare;
      return a.exerciseName.localeCompare(b.exerciseName);
    });
}

export async function getStrengthTrendData(
  userId: string,
  exerciseId: string,
): Promise<StrengthTrendData | null> {
  const sessions = await getCompletedSessions(userId);
  if (sessions.length === 0) return null;

  const exerciseMap = await getExerciseMeta([exerciseId]);
  const exercise = exerciseMap.get(exerciseId);
  if (!exercise || !isEligibleWeightedExercise(exercise)) {
    return {
      exerciseId,
      exerciseName: exercise?.name ?? 'Exercise',
      points: [],
      actualMax: null,
      estimatedOneRepMax: null,
      peerComparison: null,
    };
  }

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const sessionIds = sessions.map((session) => session.id);

  const setLogs = await fetchAllPaginatedRowsForValues<{
    session_id: string;
    actual_weight: number | null;
    actual_reps: number | null;
  }, string>(sessionIds, (chunk, from, to) =>
    supabase
      .from('set_logs')
      .select('id, session_id, actual_weight, actual_reps')
      .eq('exercise_id', exerciseId)
      .in('session_id', chunk)
      .gt('actual_weight', 0)
      .order('session_id', { ascending: true })
      .order('set_number', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );

  const peerComparisonPromise = getStrengthTrendPeerComparison(exerciseId);

  const setsBySession = new Map<
    string,
    Array<{ weight: number; reps: number | null }>
  >();

  for (const set of setLogs) {
    const weight = Number(set.actual_weight) || 0;
    if (weight <= 0) continue;

    const sessionSets = setsBySession.get(set.session_id) ?? [];
    sessionSets.push({
      weight,
      reps: set.actual_reps == null ? null : Number(set.actual_reps) || null,
    });
    setsBySession.set(set.session_id, sessionSets);
  }

  const points: StrengthTrendPoint[] = [];
  let actualMax: StrengthTrendBestMark | null = null;
  let estimatedOneRepMax: StrengthTrendBestMark | null = null;

  for (const [sessionId, sets] of setsBySession.entries()) {
    const session = sessionById.get(sessionId);
    if (!session || sets.length === 0) continue;

    let sessionTopWeight = 0;
    let sessionTopReps: number | null = null;
    let sessionBestE1rm: number | null = null;

    for (const set of sets) {
      if (
        set.weight > sessionTopWeight ||
        (set.weight === sessionTopWeight && (set.reps ?? 0) > (sessionTopReps ?? 0))
      ) {
        sessionTopWeight = set.weight;
        sessionTopReps = set.reps;
      }

      if (
        actualMax == null ||
        set.weight > actualMax.value ||
        (set.weight === actualMax.value && (set.reps ?? 0) > (actualMax.reps ?? 0))
      ) {
        actualMax = {
          value: set.weight,
          weight: set.weight,
          reps: set.reps,
          sessionId,
          sessionName: session.name,
          sessionDate: session.date,
        };
      }

      if (set.reps && set.reps > 0) {
        const estimate = e1rm(set.weight, set.reps);
        sessionBestE1rm = Math.max(sessionBestE1rm ?? 0, estimate);

        if (
          estimatedOneRepMax == null ||
          estimate > estimatedOneRepMax.value ||
          (estimate === estimatedOneRepMax.value && set.weight > estimatedOneRepMax.weight)
        ) {
          estimatedOneRepMax = {
            value: estimate,
            weight: set.weight,
            reps: set.reps,
            sessionId,
            sessionName: session.name,
            sessionDate: session.date,
          };
        }
      }
    }

    points.push({
      sessionId,
      sessionName: session.name,
      sessionDate: session.date,
      completedAt: session.completed_at ?? `${session.date}T12:00:00`,
      maxWeight: sessionTopWeight,
      reps: sessionTopReps,
      estimatedOneRepMax: sessionBestE1rm,
      setCount: sets.length,
    });
  }

  points.sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const peerComparison = await peerComparisonPromise;

  return {
    exerciseId,
    exerciseName: exercise.name,
    points,
    actualMax,
    estimatedOneRepMax,
    peerComparison,
  };
}
