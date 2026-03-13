import { supabase } from './supabase';
import { MUSCLE_GROUPS } from '@/utils/constants';
import {
  calculateMuscleStrain,
  calculateCumulativeReadiness,
  type SetData,
} from '@/utils/recoveryModel';
import { getLocalDateString } from '@/utils/date';
import { fetchSessionSets } from './workouts';

/** Entry for body map / detail sheet: readiness from strain model + optional last-strain metadata */
export interface FatigueReadinessEntry {
  muscle_group: string;
  recovery_pct: number | null;
  last_trained_at: string | null;
  volume_load: number;
  last_strain_score?: number | null;
}

/** @deprecated Use FatigueReadinessEntry; kept for type compatibility */
export type MuscleFatigue = FatigueReadinessEntry;

interface StrainSyncSession {
  id: string;
  date: string;
  completed_at: string | null;
  is_cardio?: boolean | null;
  set_count?: number | null;
}

function resolveSessionCompletedAt(session: StrainSyncSession): Date {
  if (session.completed_at) return new Date(session.completed_at);
  return new Date(`${session.date}T12:00:00`);
}

async function syncMissingWorkoutStrain(
  userId: string,
  sessions: StrainSyncSession[] | null | undefined,
): Promise<boolean> {
  const candidates = (sessions ?? []).filter(
    (session) => !session.is_cardio && Number(session.set_count ?? 0) > 0,
  );

  if (candidates.length === 0) return false;

  const sessionIds = candidates.map((session) => session.id);
  const { data: existingRows, error: existingError } = await supabase
    .from('muscle_strain_log')
    .select('session_id')
    .eq('user_id', userId)
    .in('session_id', sessionIds);

  if (existingError) throw existingError;

  const existingSessionIds = new Set(
    (existingRows ?? []).map((row: { session_id: string }) => row.session_id),
  );

  let syncedAny = false;

  for (const session of candidates) {
    if (existingSessionIds.has(session.id)) continue;

    try {
      await recordWorkoutStrain(
        userId,
        session.id,
        resolveSessionCompletedAt(session),
      );
      syncedAny = true;
    } catch (e) {
      console.warn('syncMissingWorkoutStrain session', session.id, e);
    }
  }

  return syncedAny;
}

/**
 * Fetch readiness map from strain logs (scientific model).
 * Returns one entry per MUSCLE_GROUPS with recovery_pct from cumulative strain, last_trained_at, last_strain_score.
 */
export async function fetchFatigueMap(userId: string): Promise<FatigueReadinessEntry[]> {
  return getBodyMapReadiness(userId, new Date());
}

/**
 * Backfill muscle_strain_log from existing completed workouts (for users who had workouts before strain logging existed).
 * Skips sessions that already have strain log entries.
 */
export async function backfillMuscleStrainLog(userId: string): Promise<void> {
  const { data: sessions, error: sessError } = await supabase
    .from('workout_sessions')
    .select('id, date, completed_at, is_cardio, set_count')
    .eq('user_id', userId)
    .eq('completed', true)
    .or('is_rest_day.is.null,is_rest_day.eq.false')
    .order('completed_at', { ascending: false })
    .limit(200);

  if (sessError || !sessions?.length) return;
  await syncMissingWorkoutStrain(userId, sessions as StrainSyncSession[]);
}

export async function reconcileRecentWorkoutStrain(
  userId: string,
  fromDate: Date,
  toDate: Date = new Date(),
): Promise<boolean> {
  const { data: sessions, error: sessError } = await supabase
    .from('workout_sessions')
    .select('id, date, completed_at, is_cardio, set_count')
    .eq('user_id', userId)
    .eq('completed', true)
    .or('is_rest_day.is.null,is_rest_day.eq.false')
    .gte('date', getLocalDateString(fromDate))
    .lte('date', getLocalDateString(toDate))
    .order('completed_at', { ascending: false })
    .limit(100);

  if (sessError || !sessions?.length) return false;
  return syncMissingWorkoutStrain(userId, sessions as StrainSyncSession[]);
}

/**
 * Get body map readiness as of a given time (for today or historical past day).
 * Uses muscle_strain_log and scientific cumulative readiness.
 * If user has no strain data, backfills from existing workouts then queries again.
 */
export async function getBodyMapReadiness(
  userId: string,
  asOfDate: Date = new Date()
): Promise<FatigueReadinessEntry[]> {
  const windowStart = new Date(asOfDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  let { data: strainLogs, error } = await supabase
    .from('muscle_strain_log')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_at', windowStart.toISOString())
    .lte('completed_at', asOfDate.toISOString())
    .order('completed_at', { ascending: false });

  if (error) throw error;

  const logs = strainLogs ?? [];
  let shouldReload = false;

  try {
    shouldReload = await reconcileRecentWorkoutStrain(userId, windowStart, asOfDate);
  } catch (syncError) {
    console.warn('reconcileRecentWorkoutStrain', syncError);
  }

  if (logs.length === 0) {
    const { data: anyExisting } = await supabase
      .from('muscle_strain_log')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (!anyExisting || anyExisting.length === 0) {
      await backfillMuscleStrainLog(userId);
      shouldReload = true;
    }
  }

  if (shouldReload) {
    const retry = await supabase
      .from('muscle_strain_log')
      .select('*')
      .eq('user_id', userId)
      .gte('completed_at', windowStart.toISOString())
      .lte('completed_at', asOfDate.toISOString())
      .order('completed_at', { ascending: false });

    if (!retry.error) strainLogs = retry.data;
  }

  const finalLogs = strainLogs ?? [];

  return MUSCLE_GROUPS.map((muscle_group) => {
    const muscleLogs = finalLogs.filter((log: any) => log.muscle_group === muscle_group);
    if (muscleLogs.length === 0) {
      return {
        muscle_group,
        recovery_pct: null,
        last_trained_at: null,
        volume_load: 0,
        last_strain_score: null,
      };
    }

    const workoutStrains = muscleLogs.map((log: any) => ({
      strain: Number(log.strain_score) || 0,
      completedAt: new Date(log.completed_at),
    }));

    const readiness = calculateCumulativeReadiness(muscle_group, workoutStrains, asOfDate);
    const recovery_pct = readiness === -1 ? null : readiness;
    const latest = muscleLogs[0];
    const last_strain_score = latest ? Number(latest.strain_score) ?? null : null;
    const last_trained_at = latest?.completed_at ?? null;
    const volume_load = latest ? Number(latest.total_volume) || 0 : 0;

    return {
      muscle_group,
      recovery_pct,
      last_trained_at,
      volume_load,
      last_strain_score,
    };
  });
}

export async function initializeFatigue(userId: string): Promise<void> {
  const rows = MUSCLE_GROUPS.map((muscle) => ({
    user_id: userId,
    muscle_group: muscle,
    recovery_pct: null,
    volume_load: 0,
    last_trained_at: null,
  }));

  const { error } = await supabase.from('muscle_fatigue').upsert(rows);
  if (error) throw error;
}

/** One exercise's contribution (legacy): still used by applyWorkoutFatigue for muscle_fatigue table */
export interface ExerciseVolumeContribution {
  primary_muscle: string | null;
  secondary_muscles?: string[] | null;
  volume: number;
}

/**
 * Legacy: writes to muscle_fatigue. New model uses recordWorkoutStrain + muscle_strain_log.
 * Kept so existing callers don't break; call recordWorkoutStrain after workout complete for new model.
 */
export async function applyWorkoutFatigue(
  userId: string,
  contributions: ExerciseVolumeContribution[],
): Promise<void> {
  if (contributions.length === 0) return;

  type Agg = { primaryVol: number; secondaryVol: number; primaryCount: number };
  const byMuscle = new Map<string, Agg>();

  for (const c of contributions) {
    const vol = Math.max(0, c.volume);
    if (vol <= 0) continue;

    if (c.primary_muscle) {
      const key = c.primary_muscle;
      const a = byMuscle.get(key) ?? { primaryVol: 0, secondaryVol: 0, primaryCount: 0 };
      a.primaryVol += vol;
      a.primaryCount += 1;
      byMuscle.set(key, a);
    }

    const secondaries = Array.isArray(c.secondary_muscles) ? c.secondary_muscles : [];
    for (const m of secondaries) {
      if (!m || m === c.primary_muscle) continue;
      const a = byMuscle.get(m) ?? { primaryVol: 0, secondaryVol: 0, primaryCount: 0 };
      a.secondaryVol += vol * 0.5;
      byMuscle.set(m, a);
    }
  }

  const now = new Date().toISOString();

  for (const [muscle, agg] of byMuscle) {
    let effectiveLoad = agg.primaryVol + agg.secondaryVol;
    if (agg.primaryCount >= 3) effectiveLoad *= 2.8;
    else if (agg.primaryCount >= 1) effectiveLoad *= 1.35;
    else effectiveLoad *= 0.45;
    if (effectiveLoad < 1) continue;

    await supabase.from('muscle_fatigue').upsert(
      {
        user_id: userId,
        muscle_group: muscle,
        last_trained_at: now,
        volume_load: Math.round(effectiveLoad * 10) / 10,
        recovery_pct: 0,
        updated_at: now,
      },
      { onConflict: 'user_id,muscle_group' },
    );
  }
}

/** @deprecated Use applyWorkoutFatigue with contributions */
export async function updateMuscleFatigue(
  userId: string,
  muscle: string,
  volumeLoad: number,
): Promise<void> {
  await applyWorkoutFatigue(userId, [
    { primary_muscle: muscle, volume: volumeLoad },
  ]);
}

export interface HistoricalFatigueEntry {
  muscle_group: string;
  recovery_pct: number | null;
  last_trained_at: string | null;
  volume_load: number;
  last_strain_score?: number | null;
}

/**
 * Compute muscle readiness as of end of a past day using strain logs (scientific model).
 */
export async function getHistoricalFatigueMap(
  userId: string,
  asOfDate: Date,
): Promise<HistoricalFatigueEntry[]> {
  const endOfDay = new Date(asOfDate);
  endOfDay.setHours(23, 59, 59, 999);
  const entries = await getBodyMapReadiness(userId, endOfDay);
  return entries.map((e) => ({
    muscle_group: e.muscle_group,
    recovery_pct: e.recovery_pct,
    last_trained_at: e.last_trained_at,
    volume_load: e.volume_load,
    last_strain_score: e.last_strain_score ?? null,
  }));
}

/** Nominal weight (lbs) used for bodyweight sets so they contribute to strain/readiness. */
const BODYWEIGHT_NOMINAL_LBS = 50;
/** Nominal weight (lbs) and rep-equivalent for time-under-tension (e.g. 60s plank ≈ 4 reps at 25 lbs). */
const TIME_BASED_NOMINAL_LBS = 25;
const TIME_BASED_SECONDS_PER_REP = 15;

/**
 * Record strain per muscle for a completed workout into muscle_strain_log.
 * Call after set_logs are saved and session is completed.
 * Handles weighted sets, bodyweight sets (reps only), and time-based sets (actual_seconds) so
 * every exercise type from the DB affects the Muscle Readiness map accurately.
 */
export async function recordWorkoutStrain(
  userId: string,
  sessionId: string,
  completedAt: Date,
): Promise<void> {
  const setLogs = await fetchSessionSets(sessionId);
  if (!setLogs || setLogs.length === 0) return;

  const exerciseIds = [...new Set(setLogs.map((s) => s.exercise_id).filter(Boolean))];
  if (exerciseIds.length === 0) return;

  const { data: exercises, error: exError } = await supabase
    .from('exercises')
    .select('id, primary_muscle, secondary_muscles, movement_pattern')
    .in('id', exerciseIds);

  if (exError) throw exError;
  const exMap = new Map((exercises ?? []).map((e: any) => [e.id, e]));

  const muscleSetData: Record<string, SetData[]> = {};

  for (const set of setLogs) {
    if (!set.completed || (set as any).is_warmup) continue;
    const ex = exMap.get(set.exercise_id);
    if (!ex) continue;

    const rawWeight = Number(set.actual_weight) ?? 0;
    const rawReps = Number(set.actual_reps) ?? 0;
    const seconds = Number((set as any).actual_seconds) ?? 0;

    let weight: number;
    let reps: number;

    if (seconds > 0) {
      weight = TIME_BASED_NOMINAL_LBS;
      reps = Math.max(1, Math.ceil(seconds / TIME_BASED_SECONDS_PER_REP));
    } else if (rawWeight > 0 && rawReps > 0) {
      weight = rawWeight;
      reps = rawReps;
    } else if (rawWeight === 0 && rawReps > 0) {
      weight = BODYWEIGHT_NOMINAL_LBS;
      reps = rawReps;
    } else {
      continue;
    }

    const movementPattern = (ex.movement_pattern as string) || 'isolation';
    const primary = (ex.primary_muscle as string)?.toLowerCase?.();
    const secondaries = (Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [])
      .map((m: string) => (m || '').toLowerCase())
      .filter(Boolean);

    const baseSet: SetData = {
      weight,
      reps,
      exerciseMovementPattern: movementPattern,
      isPrimaryMuscle: true,
      exerciseId: set.exercise_id,
    };

    if (primary) {
      if (!muscleSetData[primary]) muscleSetData[primary] = [];
      muscleSetData[primary].push({ ...baseSet, isPrimaryMuscle: true });
    }

    for (const sec of secondaries) {
      if (!sec || sec === primary) continue;
      if (!muscleSetData[sec]) muscleSetData[sec] = [];
      muscleSetData[sec].push({ ...baseSet, isPrimaryMuscle: false, exerciseId: set.exercise_id });
    }
  }

  const completedAtIso = completedAt.toISOString();
  const rows = Object.entries(muscleSetData)
    .filter(([muscle_group]) => muscle_group !== 'cardio')
    .map(([muscle_group, sets]) => {
      const strain_score = calculateMuscleStrain(muscle_group, sets);
      const total_volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const exercise_count = new Set(
        sets.map((s) => s.exerciseId).filter(Boolean)
      ).size;

      return {
        user_id: userId,
        session_id: sessionId,
        muscle_group,
        strain_score,
        total_volume: Math.round(total_volume * 10) / 10,
        set_count: sets.length,
        exercise_count,
        completed_at: completedAtIso,
      };
    });

  if (rows.length === 0) return;

  const { error: deleteError } = await supabase
    .from('muscle_strain_log')
    .delete()
    .eq('user_id', userId)
    .eq('session_id', sessionId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from('muscle_strain_log')
    .insert(rows);

  if (insertError) throw insertError;
}
