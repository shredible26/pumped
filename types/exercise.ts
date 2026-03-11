export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'hip_hinge'
  | 'squat'
  | 'lunge'
  | 'isolation_push'
  | 'isolation_pull'
  | 'core'
  | 'cardio';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'cardio_machine';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type BigThreeType = 'squat' | 'bench' | 'deadlift';

export interface Exercise {
  id: string;
  name: string;
  primary_muscle: string;
  secondary_muscles: string[];
  movement_pattern: MovementPattern;
  equipment: Equipment;
  difficulty: Difficulty;
  fatigue_rating: number;
  is_big_three: boolean;
  big_three_type: BigThreeType | null;
  goal_tags: string[];
  aesthetic_targets: string[];
  created_at: string;
}
