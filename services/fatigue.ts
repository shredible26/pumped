import { supabase } from './supabase';
import { MuscleFatigue } from '@/types/workout';
import { MUSCLE_GROUPS } from '@/utils/constants';

export async function fetchFatigueMap(userId: string): Promise<MuscleFatigue[]> {
  const { data, error } = await supabase
    .from('muscle_fatigue')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data as MuscleFatigue[];
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

/** One exercise's contribution: volume for this exercise + primary vs secondary role */
export interface ExerciseVolumeContribution {
  primary_muscle: string | null;
  /** Each secondary muscle gets 50% of this exercise's volume */
  secondary_muscles?: string[] | null;
  /** Sum of weight * reps for all sets of this exercise */
  volume: number;
}

/**
 * Aggregate volume per muscle: primary = 100% volume; each secondary = 50% volume.
 * Count how many exercises had this muscle as primary — 3+ → heavy fatigue multiplier.
 * Upsert each muscle with last_trained_at now and scaled volume_load for decay model.
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
    // Effective load: primary volume full + secondary at 50% already in secondaryVol
    let effectiveLoad = agg.primaryVol + agg.secondaryVol;

    // 3+ exercises as primary → heavy fatigue (stay red longer)
    if (agg.primaryCount >= 3) {
      effectiveLoad *= 2.8;
    } else if (agg.primaryCount >= 1) {
      effectiveLoad *= 1.35;
    } else {
      // Secondary only → lighter hit (ramps toward yellow faster)
      effectiveLoad *= 0.45;
    }

    if (effectiveLoad < 1) continue;

    const { error } = await supabase.from('muscle_fatigue').upsert(
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
    if (error) console.warn('applyWorkoutFatigue upsert', muscle, error);
  }
}

/** @deprecated Use applyWorkoutFatigue with contributions for accurate primary/secondary weighting */
export async function updateMuscleFatigue(
  userId: string,
  muscle: string,
  volumeLoad: number,
): Promise<void> {
  await applyWorkoutFatigue(userId, [
    { primary_muscle: muscle, volume: volumeLoad },
  ]);
}
