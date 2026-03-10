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
  { id: 'ppl', label: 'Push/Pull/Legs', description: 'Classic 6-day split with AI-generated workouts' },
  { id: 'upper_lower', label: 'Upper/Lower', description: '4-day split with AI-powered exercise selection' },
  { id: 'aesthetic', label: 'Aesthetic', description: 'Optimized with AI for aesthetics and proportions' },
  { id: 'ai_optimal', label: 'AI Optimal', description: 'Fully balanced and optimized by AI, hitting every muscle group' },
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
