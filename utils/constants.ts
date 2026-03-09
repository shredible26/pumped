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
  { id: 'ppl', label: 'Push/Pull/Legs', description: 'The classic 6-day split. Each day targets push, pull, or leg muscles.' },
  { id: 'upper_lower', label: 'Upper/Lower', description: '4-day split alternating upper and lower body.' },
  { id: 'bro_split', label: 'Bro Split', description: 'Each day dedicated to one muscle group.' },
  { id: 'full_body', label: 'Full Body', description: 'Hit every muscle group each session, 3x/week.' },
  { id: 'ai_optimal', label: 'AI Optimal', description: 'Let the AI build your ideal program.' },
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
