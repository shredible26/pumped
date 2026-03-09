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

export async function updateMuscleFatigue(
  userId: string,
  muscle: string,
  volumeLoad: number,
): Promise<void> {
  const { error } = await supabase
    .from('muscle_fatigue')
    .upsert({
      user_id: userId,
      muscle_group: muscle,
      last_trained_at: new Date().toISOString(),
      volume_load: volumeLoad,
      recovery_pct: 0,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}
