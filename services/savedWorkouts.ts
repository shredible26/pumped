import { supabase } from './supabase';

export interface SavedWorkoutSetDetail {
  set_number: number;
  weight?: number | null;
  reps?: number | null;
  seconds?: number | null;
}

export interface SavedWorkoutExercise {
  name: string;
  sets: number;
  set_details: SavedWorkoutSetDetail[];
}

export interface SavedWorkoutRecord {
  id: string;
  user_id: string;
  name: string;
  workout_type: string | null;
  exercises: unknown;
  last_used_at: string | null;
  use_count: number | null;
  created_at?: string | null;
}

type RawSavedWorkoutSetDetail = {
  set_number?: unknown;
  weight?: unknown;
  reps?: unknown;
  seconds?: unknown;
  actual_weight?: unknown;
  actual_reps?: unknown;
  actual_seconds?: unknown;
  target_weight?: unknown;
  target_reps?: unknown;
  target_seconds?: unknown;
};

type RawSavedWorkoutExercise = {
  name?: unknown;
  sets?: unknown;
  set_details?: unknown;
  target_weight?: unknown;
  target_weight_lbs?: unknown;
  target_reps?: unknown;
  target_seconds?: unknown;
};

function toPositiveInt(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function toNullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableRepCount(value: unknown): number | null {
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    if (match) {
      return toNullableNumber(match[0]);
    }
  }
  return toNullableNumber(value);
}

function buildFallbackSetDetails(rawExercise: RawSavedWorkoutExercise): SavedWorkoutSetDetail[] {
  const sets = toPositiveInt(rawExercise.sets, 1);
  const reps = toNullableRepCount(rawExercise.target_reps);
  const seconds = toNullableNumber(rawExercise.target_seconds);
  const weight =
    toNullableNumber(rawExercise.target_weight) ??
    toNullableNumber(rawExercise.target_weight_lbs);

  return Array.from({ length: sets }, (_, index) => ({
    set_number: index + 1,
    ...(weight != null ? { weight } : {}),
    ...(seconds != null && seconds > 0 ? { seconds } : {}),
    ...(seconds == null && reps != null ? { reps } : {}),
  }));
}

function normalizeSetDetails(
  rawSetDetails: unknown,
  rawExercise: RawSavedWorkoutExercise,
): SavedWorkoutSetDetail[] {
  if (!Array.isArray(rawSetDetails)) {
    return buildFallbackSetDetails(rawExercise);
  }

  const normalized = rawSetDetails
    .map((rawSet, index) => {
      const candidate = rawSet as RawSavedWorkoutSetDetail;
      const setNumber = toPositiveInt(candidate.set_number, index + 1);
      const weight =
        toNullableNumber(candidate.weight) ??
        toNullableNumber(candidate.actual_weight) ??
        toNullableNumber(candidate.target_weight);
      const seconds =
        toNullableNumber(candidate.seconds) ??
        toNullableNumber(candidate.actual_seconds) ??
        toNullableNumber(candidate.target_seconds);
      const reps =
        toNullableRepCount(candidate.reps) ??
        toNullableRepCount(candidate.actual_reps) ??
        (seconds == null ? toNullableRepCount(candidate.target_reps) : null);

      return {
        set_number: setNumber,
        ...(weight != null ? { weight } : {}),
        ...(reps != null ? { reps } : {}),
        ...(seconds != null ? { seconds } : {}),
      };
    })
    .sort((a, b) => a.set_number - b.set_number);

  return normalized.length > 0 ? normalized : buildFallbackSetDetails(rawExercise);
}

export function normalizeSavedWorkoutExercises(
  rawExercises: unknown,
): SavedWorkoutExercise[] {
  if (!Array.isArray(rawExercises)) return [];

  return rawExercises
    .map((rawExercise) => {
      const candidate = rawExercise as RawSavedWorkoutExercise;
      const name = typeof candidate?.name === 'string' ? candidate.name.trim() : '';
      if (!name) return null;

      const setDetails = normalizeSetDetails(candidate.set_details, candidate);
      const sets = Math.max(toPositiveInt(candidate.sets, setDetails.length || 1), setDetails.length);

      return {
        name,
        sets,
        set_details:
          setDetails.length > 0
            ? setDetails
            : Array.from({ length: sets }, (_, index) => ({ set_number: index + 1 })),
      };
    })
    .filter((exercise): exercise is SavedWorkoutExercise => exercise != null);
}

export async function fetchSavedWorkoutById(
  userId: string,
  savedWorkoutId: string,
): Promise<SavedWorkoutRecord | null> {
  const { data, error } = await supabase
    .from('saved_workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', savedWorkoutId)
    .maybeSingle();

  if (error) throw error;
  return (data as SavedWorkoutRecord | null) ?? null;
}

export async function updateSavedWorkout(
  userId: string,
  savedWorkoutId: string,
  updates: Partial<Pick<SavedWorkoutRecord, 'name' | 'workout_type' | 'exercises'>>,
): Promise<void> {
  const { error } = await supabase
    .from('saved_workouts')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', savedWorkoutId);

  if (error) throw error;
}

export async function deleteSavedWorkout(
  userId: string,
  savedWorkoutId: string,
): Promise<void> {
  const { error } = await supabase
    .from('saved_workouts')
    .delete()
    .eq('user_id', userId)
    .eq('id', savedWorkoutId);

  if (error) throw error;
}
