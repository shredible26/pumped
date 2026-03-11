export type WorkoutSource = 'ai_generated' | 'custom';

export type WorkoutType =
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'full'
  | 'chest_tris'
  | 'back_bis'
  | 'shoulders'
  | 'arms';

export interface WorkoutSession {
  id: string;
  user_id: string;
  date: string;
  name: string;
  workout_type: WorkoutType | null;
  source: WorkoutSource;
  duration_seconds: number | null;
  total_volume: number;
  exercise_count: number;
  set_count: number;
  pr_count: number;
  completed: boolean;
  is_rest_day?: boolean;
  is_cardio?: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SetLog {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_order: number;
  set_number: number;
  target_weight: number | null;
  target_reps: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  actual_seconds?: number | null;
  is_warmup: boolean;
  is_pr: boolean;
  completed: boolean;
  created_at: string;
}

export interface MuscleFatigue {
  user_id: string;
  muscle_group: string;
  last_trained_at: string | null;
  volume_load: number;
  recovery_pct: number | null;
  updated_at: string;
}

export interface StrengthHistory {
  id: string;
  user_id: string;
  squat_e1rm: number | null;
  bench_e1rm: number | null;
  deadlift_e1rm: number | null;
  total_score: number | null;
  recorded_at: string;
}

export interface AIWorkoutPlan {
  id: string;
  user_id: string;
  plan_date: string;
  workout_name: string;
  workout_type: WorkoutType | null;
  exercises: AIExercisePlan[];
  generated_at: string;
  used: boolean;
}

export interface AIExercisePlan {
  exercise_id: string;
  name: string;
  sets: number;
  target_reps: string;
  target_weight: number;
  rest_seconds: number;
  why: string;
  order: number;
}
