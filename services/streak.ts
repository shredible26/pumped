import { supabase } from './supabase';

/**
 * Calculate current streak from workout_sessions.
 * - Counts only days where the user logged at least one actual workout (completed and not rest-day-only).
 * - Active Recovery days count if the user logged any workout (e.g. cardio); rest-day-only logs do not extend the streak.
 */
export async function calculateStreak(userId: string): Promise<number> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('date, completed, is_rest_day')
    .eq('user_id', userId)
    .eq('completed', true)
    .or('is_rest_day.is.null,is_rest_day.eq.false')
    .order('date', { ascending: false });

  if (!sessions || sessions.length === 0) return 0;

  const uniqueDates = [...new Set(sessions.map((s) => s.date))].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  let streak = 0;
  let checkDate = new Date(uniqueDates[0] + 'T12:00:00Z');

  for (const dateStr of uniqueDates) {
    const expected = checkDate.toISOString().split('T')[0];
    if (dateStr === expected) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Recalculate streak and update profile. Returns the new streak and whether it's a new longest.
 */
export async function updateProfileStreak(userId: string): Promise<{
  current_streak_days: number;
  longest_streak_days: number;
}> {
  const streak = await calculateStreak(userId);

  const { data: profile } = await supabase
    .from('profiles')
    .select('longest_streak_days')
    .eq('id', userId)
    .single();

  const prevLongest = profile?.longest_streak_days ?? 0;
  const longest = Math.max(prevLongest, streak);

  await supabase
    .from('profiles')
    .update({
      current_streak_days: streak,
      longest_streak_days: longest,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return { current_streak_days: streak, longest_streak_days: longest };
}
