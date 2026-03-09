import { supabase } from './supabase';
import { AIWorkoutPlan } from '@/types/workout';

export async function generateWorkout(): Promise<AIWorkoutPlan> {
  const { data, error } = await supabase.functions.invoke('generate-workout');
  if (error) throw error;
  return data as AIWorkoutPlan;
}

export async function fetchTodayPlan(userId: string): Promise<AIWorkoutPlan | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('ai_workout_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', today)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as AIWorkoutPlan | null;
}
