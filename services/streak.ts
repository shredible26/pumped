import { supabase } from './supabase';

/**
 * Calculate current streak from workout_sessions.
 * - Counts days with at least one completed workout OR is_rest_day (rest days don't break the streak).
 * - Streak = consecutive days (today/yesterday backward) that have activity.
 */
export async function calculateStreak(userId: string): Promise<number> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('date, completed, is_rest_day')
    .eq('user_id', userId)
    .or('completed.eq.true,is_rest_day.eq.true')
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
