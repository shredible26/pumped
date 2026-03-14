import { fetchCompletedWorkoutCount } from './workouts';
import { supabase } from './supabase';
import { fetchAllPaginatedRows } from '@/utils/supabasePagination';

export interface DashboardStats {
  workoutCount: number;
  volumeTotal: number;
}

export async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const [workoutCount, sessionsRes] = await Promise.all([
    fetchCompletedWorkoutCount(userId),
    fetchAllPaginatedRows<{ total_volume: number | null }>((from, to) =>
      supabase
        .from('workout_sessions')
        .select('total_volume')
        .eq('user_id', userId)
        .eq('completed', true)
        .or('is_rest_day.is.null,is_rest_day.eq.false')
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  const volumeTotal = sessionsRes.reduce(
    (sum, session) => sum + (Number(session.total_volume) || 0),
    0,
  );

  return {
    workoutCount,
    volumeTotal,
  };
}
