import { getVolumeChartData } from './volume';
import { fetchCompletedWorkoutCount } from './workouts';

export interface DashboardStats {
  workoutCount: number;
  weeklyVolumeTotal: number;
}

export async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const [workoutCount, volumeData] = await Promise.all([
    fetchCompletedWorkoutCount(userId),
    getVolumeChartData(userId, 'week'),
  ]);

  return {
    workoutCount,
    weeklyVolumeTotal: volumeData.total,
  };
}
