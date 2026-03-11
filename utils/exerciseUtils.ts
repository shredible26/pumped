/**
 * Helpers for bodyweight and time-based exercises (planks, deadhangs, etc.)
 */

export function isBodyweight(equipment: string | undefined | null): boolean {
  if (!equipment) return false;
  return String(equipment).toLowerCase() === 'bodyweight';
}

const TIME_BASED_NAME_PATTERNS = [
  'plank',
  'dead hang',
  'deadhang',
  'hang',
  ' hold',
  'l-sit',
  'l sit',
  'hollow hold',
  'second',
  'isometric',
  'wall sit',
  'captain\'s chair',
  'captains chair',
];

export function isTimeBasedExercise(name: string | undefined | null): boolean {
  if (!name) return false;
  const lower = String(name).toLowerCase();
  return TIME_BASED_NAME_PATTERNS.some((p) => lower.includes(p));
}

export function showWeightInput(equipment: string | undefined | null): boolean {
  return !isBodyweight(equipment);
}

export function showSecondsInput(
  equipment: string | undefined | null,
  name: string | undefined | null
): boolean {
  return isBodyweight(equipment) && isTimeBasedExercise(name);
}
