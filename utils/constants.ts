export const MUSCLE_GROUPS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'traps',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const PROGRAM_STYLES = [
  { id: 'ppl', label: 'Push/Pull/Legs', description: 'Push/Pull/Legs · AI-generated workouts · Cardio on rest days' },
  { id: 'upper_lower', label: 'Upper/Lower', description: 'Upper/Lower split · AI-powered · Cardio on rest days' },
  { id: 'aesthetic', label: 'Aesthetic', description: 'Optimized by AI for aesthetics · Cardio on rest days' },
  { id: 'ai_optimal', label: 'AI Optimal', description: 'Fully AI-optimized · Smart cardio scheduling' },
] as const;

export const EQUIPMENT_OPTIONS = [
  { id: 'full_gym', label: 'Full Gym' },
  { id: 'home_gym', label: 'Home Gym' },
  { id: 'bodyweight', label: 'Bodyweight' },
] as const;

export const REST_DURATIONS = {
  main_compound: 180,
  secondary_compound: 120,
  isolation: 75,
} as const;
