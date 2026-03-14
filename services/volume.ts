import { supabase } from './supabase';
import { startOfWeek, startOfMonth, endOfMonth, endOfWeek, format, parseISO } from 'date-fns';
import {
  fetchAllPaginatedRows,
  fetchAllPaginatedRowsForValues,
} from '@/utils/supabasePagination';

export interface MuscleDistributionEntry {
  muscle: string;
  volume: number;
  percentage: number;
}

/** Volume per day/week/month for chart. */
export interface VolumeEntry {
  label: string;
  volume: number;
  date?: string;
}

/**
 * Compute muscle distribution from set_logs joined with exercises (primary + 50% secondary).
 * Period: 'week' = current week, 'month' = last 30 days, 'all' = all time.
 */
export async function calculateMuscleDistribution(
  userId: string,
  period: 'week' | 'month' | 'all' = 'month'
): Promise<MuscleDistributionEntry[]> {
  const now = new Date();
  const weekStart =
    period === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) : null;
  const weekEnd =
    period === 'week' ? endOfWeek(now, { weekStartsOn: 1 }) : null;
  const monthCutoff = (() => {
    if (period !== 'month') return null;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    return cutoff;
  })();

  const sessions = await fetchAllPaginatedRows<{ id: string }>((from, to) => {
    let query = supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('completed', true)
      .or('is_rest_day.is.null,is_rest_day.eq.false')
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);

    if (period === 'week' && weekStart && weekEnd) {
      query = query
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'));
    } else if (period === 'month' && monthCutoff) {
      query = query.gte('date', monthCutoff.toISOString().split('T')[0]);
    }

    return query;
  });

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const sets = await fetchAllPaginatedRowsForValues<{
    session_id: string;
    exercise_id: string | null;
    actual_weight: number | null;
    actual_reps: number | null;
  }, string>(sessionIds, (chunk, from, to) =>
    supabase
      .from('set_logs')
      .select('id, session_id, exercise_id, actual_weight, actual_reps')
      .in('session_id', chunk)
      .order('id', { ascending: true })
      .range(from, to),
  );

  const exerciseIds = [...new Set(sets.map((s) => s.exercise_id).filter(Boolean))] as string[];
  if (exerciseIds.length === 0) return [];

  const exercises = await fetchAllPaginatedRowsForValues<{
    id: string;
    primary_muscle: string | null;
    secondary_muscles: string[] | null;
  }, string>(exerciseIds, (chunk, from, to) =>
    supabase
      .from('exercises')
      .select('id, primary_muscle, secondary_muscles')
      .in('id', chunk)
      .order('id', { ascending: true })
      .range(from, to),
  );
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  const byMuscle = new Map<string, number>();
  let total = 0;

  for (const set of sets) {
    const w = Number(set.actual_weight) || 0;
    const r = Number(set.actual_reps) || 0;
    const vol = w * r;
    if (vol <= 0) continue;
    const ex = exMap.get(set.exercise_id ?? '');
    const primary = ex?.primary_muscle;
    const secondaries = (ex?.secondary_muscles as string[]) || [];
    if (primary) {
      byMuscle.set(primary, (byMuscle.get(primary) ?? 0) + vol);
      total += vol;
    }
    for (const m of secondaries) {
      if (m && m !== primary) {
        byMuscle.set(m, (byMuscle.get(m) ?? 0) + vol * 0.5);
        total += vol * 0.5;
      }
    }
  }

  if (total <= 0) return [];
  return [...byMuscle.entries()]
    .map(([muscle, volume]) => ({
      muscle,
      volume,
      percentage: Math.round((volume / total) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Fetch volume data for chart: week = daily bars, month = weekly bars, year = monthly bars.
 */
export async function getVolumeChartData(
  userId: string,
  period: 'week' | 'month' | 'year'
): Promise<{ entries: VolumeEntry[]; total: number }> {
  const sessions = await fetchAllPaginatedRows<{
    id: string;
    date: string;
    total_volume: number | null;
  }>((from, to) =>
    supabase
      .from('workout_sessions')
      .select('id, date, total_volume')
      .eq('user_id', userId)
      .eq('completed', true)
      .or('is_rest_day.is.null,is_rest_day.eq.false')
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );

  if (!sessions || sessions.length === 0) {
    if (period === 'week')
      return {
        entries: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => ({ label: d, volume: 0 })),
        total: 0,
      };
    if (period === 'month')
      return {
        entries: ['W1', 'W2', 'W3', 'W4'].map((w) => ({ label: w, volume: 0 })),
        total: 0,
      };
    return {
      entries: [],
      total: 0,
    };
  }

  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const d = s.date || '';
    const v = Number(s.total_volume) || 0;
    byDate.set(d, (byDate.get(d) ?? 0) + v);
  }

  const now = new Date();
  let entries: VolumeEntry[] = [];
  let total = 0;

  if (period === 'week') {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const vol = byDate.get(dateStr) ?? 0;
      total += vol;
      entries.push({ label: labels[i], volume: vol, date: dateStr });
    }
  } else if (period === 'month') {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      let vol = 0;
      for (const [dateStr, v] of byDate) {
        const dt = parseISO(dateStr);
        if (dt >= weekStart && dt <= weekEnd) vol += v;
      }
      entries.push({ label: `W${w + 1}`, volume: vol });
    }
    total = [...byDate.entries()]
      .filter(([dateStr]) => {
        const dt = parseISO(dateStr);
        return dt >= monthStart && dt <= monthEnd;
      })
      .reduce((a, [, v]) => a + v, 0);
  } else {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byMonth = new Map<number, number>();
    for (const [dateStr, v] of byDate) {
      const dt = parseISO(dateStr);
      if (dt.getFullYear() === now.getFullYear()) {
        const m = dt.getMonth();
        byMonth.set(m, (byMonth.get(m) ?? 0) + v);
        total += v;
      }
    }
    entries = labels.map((label, i) => ({ label, volume: byMonth.get(i) ?? 0 }));
  }

  if (period === 'week') {
    total = entries.reduce((a, e) => a + e.volume, 0);
  } else if (period === 'year') {
    total = entries.reduce((a, e) => a + e.volume, 0);
  }
  return { entries, total };
}
