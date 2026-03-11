import { supabase } from './supabase';
import { Exercise } from '@/types/exercise';

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name');

  if (error) throw error;
  return data as Exercise[];
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20);

  if (error) throw error;
  return data as Exercise[];
}

export async function fetchCardioExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('movement_pattern', 'cardio')
    .order('name');

  if (error) throw error;
  return data as Exercise[];
}
