export type ProgramStyle = 'ppl' | 'upper_lower' | 'bro_split' | 'full_body' | 'ai_optimal';
export type EquipmentAccess = 'full_gym' | 'home_gym' | 'bodyweight';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type Gender = 'male' | 'female' | 'other';

export interface Profile {
  id: string;
  display_name: string;
  gender: Gender | null;
  age: number | null;
  height_inches: number | null;
  weight_lbs: number | null;
  program_style: ProgramStyle;
  training_frequency: number;
  equipment_access: EquipmentAccess;
  experience_level: ExperienceLevel;
  strength_score: number;
  squat_e1rm: number;
  bench_e1rm: number;
  deadlift_e1rm: number;
  current_streak_days: number;
  longest_streak_days: number;
  total_workouts: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
