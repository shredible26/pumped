import { supabase } from './supabase';
import { e1rm } from '@/utils/epley';
import { format } from 'date-fns';

export type Big3Lift = 'squat' | 'bench' | 'deadlift';

export interface Big3Entry {
  value: number;
  source: string;
  date: string;
}

export interface Big3Result {
  squat: Big3Entry | null;
  bench: Big3Entry | null;
  deadlift: Big3Entry | null;
  total: number;
}

export async function getBig3(userId: string): Promise<Big3Result> {
  const result: Big3Result = {
    squat: null,
    bench: null,
    deadlift: null,
    total: 0,
  };

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'squat_e1rm, bench_e1rm, deadlift_e1rm, manual_squat_1rm, manual_bench_1rm, manual_deadlift_1rm'
    )
    .eq('id', userId)
    .single();

  const manualSquat = profile?.manual_squat_1rm != null ? Number(profile.manual_squat_1rm) : 0;
  const manualBench = profile?.manual_bench_1rm != null ? Number(profile.manual_bench_1rm) : 0;
  const manualDeadlift =
    profile?.manual_deadlift_1rm != null ? Number(profile.manual_deadlift_1rm) : 0;
  const profileSquat = profile?.squat_e1rm != null ? Number(profile.squat_e1rm) : 0;
  const profileBench = profile?.bench_e1rm != null ? Number(profile.bench_e1rm) : 0;
  const profileDeadlift = profile?.deadlift_e1rm != null ? Number(profile.deadlift_e1rm) : 0;

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, big_three_type')
    .or('big_three_type.eq.squat,big_three_type.eq.bench,big_three_type.eq.deadlift');
  const typeToIds = new Map<Big3Lift, string[]>();
  for (const e of exercises || []) {
    const t = (e as any).big_three_type as Big3Lift;
    if (t) {
      const arr = typeToIds.get(t) ?? [];
      arr.push(e.id);
      typeToIds.set(t, arr);
    }
  }

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, date')
    .eq('user_id', userId)
    .eq('completed', true)
    .or('is_rest_day.is.null,is_rest_day.eq.false');

  if (!sessions || sessions.length === 0) {
    for (const lift of ['squat', 'bench', 'deadlift'] as Big3Lift[]) {
      const manual = lift === 'squat' ? manualSquat : lift === 'bench' ? manualBench : manualDeadlift;
      const fromProfile =
        lift === 'squat' ? profileSquat : lift === 'bench' ? profileBench : profileDeadlift;
      const best = Math.max(manual, fromProfile);
      if (best > 0) {
        result[lift] =
          manual >= fromProfile
            ? { value: manual, source: 'Manually entered', date: '' }
            : { value: fromProfile, source: 'From logged workouts', date: '' };
      }
    }
    result.total =
      (result.squat?.value ?? 0) + (result.bench?.value ?? 0) + (result.deadlift?.value ?? 0);
    return result;
  }

  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id);
    const sessionDates = new Map(
      (sessions as { id: string; date?: string }[]).map((s) => [s.id, s.date || ''])
    );
    const { data: sets } = await supabase
      .from('set_logs')
      .select('session_id, exercise_id, actual_weight, actual_reps, created_at')
      .in('session_id', sessionIds)
      .not('actual_weight', 'is', null)
      .not('actual_reps', 'is', null);

    for (const lift of ['squat', 'bench', 'deadlift'] as Big3Lift[]) {
      const ids = typeToIds.get(lift) ?? [];
      if (ids.length === 0) continue;
      let maxE1 = 0;
      let bestSource = '';
      let bestDate = '';

      for (const set of sets || []) {
        const s = set as any;
        if (!ids.includes(s.exercise_id)) continue;
        const w = Number(s.actual_weight) || 0;
        const r = Number(s.actual_reps) || 0;
        if (w <= 0 || r <= 0) continue;
        const est = e1rm(w, r);
        if (est > maxE1) {
          maxE1 = est;
          const date = sessionDates.get(s.session_id) || s.created_at?.split('T')[0] || '';
          bestSource = `Based on ${w} × ${r}`;
          bestDate = date;
        }
      }

      const manual =
        lift === 'squat' ? manualSquat : lift === 'bench' ? manualBench : manualDeadlift;
      const fromProfile =
        lift === 'squat' ? profileSquat : lift === 'bench' ? profileBench : profileDeadlift;
      const best = Math.max(maxE1, manual, fromProfile);

      if (best > 0) {
        if (manual >= best) {
          result[lift] = { value: manual, source: 'Manually entered', date: '' };
        } else if (maxE1 >= best) {
          result[lift] = {
            value: maxE1,
            source: bestSource,
            date: bestDate ? format(new Date(bestDate + 'T12:00:00'), 'MMM d') : '',
          };
        } else {
          result[lift] = {
            value: fromProfile,
            source: 'From logged workouts',
            date: '',
          };
        }
      }
    }
  }

  for (const lift of ['squat', 'bench', 'deadlift'] as Big3Lift[]) {
    const manual = lift === 'squat' ? manualSquat : lift === 'bench' ? manualBench : manualDeadlift;
    const fromProfile =
      lift === 'squat' ? profileSquat : lift === 'bench' ? profileBench : profileDeadlift;
    const current = result[lift]?.value ?? 0;
    const best = Math.max(current, manual, fromProfile);
    if (best <= 0) continue;
    if (result[lift] == null || result[lift]!.value < best) {
      if (manual >= best) {
        result[lift] = { value: manual, source: 'Manually entered', date: '' };
      } else if (fromProfile >= best) {
        result[lift] = { value: fromProfile, source: 'From logged workouts', date: '' };
      }
    }
  }

  result.total =
    (result.squat?.value ?? 0) + (result.bench?.value ?? 0) + (result.deadlift?.value ?? 0);
  return result;
}
