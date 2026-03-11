import { supabase } from './supabase';
import { WorkoutSession, SetLog } from '@/types/workout';

export async function createSession(
  session: Partial<WorkoutSession>,
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert(session)
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSession;
}

export async function completeSession(
  sessionId: string,
  updates: Partial<WorkoutSession>,
): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ ...updates, completed: true, completed_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function fetchSessions(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', true)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data as WorkoutSession[];
}

export async function fetchSessionById(sessionId: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as WorkoutSession | null;
}

export async function fetchSessionSets(sessionId: string): Promise<SetLog[]> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('exercise_order')
    .order('set_number');

  if (error) throw error;
  return data as SetLog[];
}

export async function insertSetLogs(sets: Partial<SetLog>[]): Promise<void> {
  const { error } = await supabase.from('set_logs').insert(sets);
  if (error) throw error;
}

/** Delete a completed session (and its set_logs via DB cascade). Call after confirming with user. */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

/** Update session fields (e.g. name, duration_seconds). */
export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<WorkoutSession, 'name' | 'duration_seconds'>>
): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update(updates)
    .eq('id', sessionId);
  if (error) throw error;
}
