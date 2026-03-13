/**
 * Helpers for classifying exercises that should log duration instead of reps.
 * The duration list mirrors the seeded exercise SQL so running/walking-style
 * activities use a single mm:ss entry and do not expose multi-set rep logging.
 */

export interface ExerciseLoggingInput {
  equipment?: string | null;
  name?: string | null;
  movement_pattern?: string | null;
  primary_muscle?: string | null;
  goal_tags?: string[] | null;
}

function normalizeExerciseName(name: string | undefined | null): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isBodyweight(equipment: string | undefined | null): boolean {
  if (!equipment) return false;
  return String(equipment).toLowerCase() === 'bodyweight';
}

const DURATION_BASED_EXERCISES = new Set(
  [
    'Walking',
    'Running',
    'Treadmill (Incline Walk)',
    'Stairmaster',
    'Stationary Bike',
    'Elliptical',
    'Jump Rope',
    'Rowing Machine',
    'Swimming',
    'Sprints',
    'Hill Sprints',
    'Battle Ropes',
    'Assault Bike',
    'Ski Erg',
    'Cycling (Outdoor)',
    'Hiking',
    'Sled Push',
    'Sled Pull',
    'Treadmill Running',
    'Treadmill Sprint Intervals',
    'Shadow Boxing',
    'Jumping Jacks',
    'High Knees',
    'Plank',
    'Side Plank',
    'Dead Hang',
    'Wall Sit',
    'L-Sit',
    'Hollow Hold',
    'Foam Rolling (Full Body)',
    'Hip Flexor Stretch',
    'Hamstring Stretch',
    'Chest Doorway Stretch',
    "Child's Pose",
    'Pigeon Stretch',
    'Plate Pinch',
    "Farmer's Carry",
    "Farmer's Walk",
  ].map(normalizeExerciseName)
);

const DURATION_WITH_WEIGHT_EXERCISES = new Set(
  ['Plate Pinch', "Farmer's Carry", "Farmer's Walk", 'Sled Push', 'Sled Pull'].map(
    normalizeExerciseName
  )
);

function hasRecoveryTag(goalTags: string[] | undefined | null): boolean {
  return Array.isArray(goalTags) && goalTags.some((tag) => String(tag).toLowerCase() === 'recovery');
}

function toExerciseLoggingInput(
  exerciseOrEquipment: ExerciseLoggingInput | string | undefined | null,
  name?: string | null
): ExerciseLoggingInput {
  if (
    typeof exerciseOrEquipment === 'string' ||
    exerciseOrEquipment == null
  ) {
    return { equipment: exerciseOrEquipment, name };
  }
  return exerciseOrEquipment;
}

export function isDurationExercise(
  exerciseOrEquipment: ExerciseLoggingInput | string | undefined | null,
  name?: string | null
): boolean {
  const exercise = toExerciseLoggingInput(exerciseOrEquipment, name);
  const normalizedName = normalizeExerciseName(exercise.name);

  if (!normalizedName) return false;
  if (DURATION_BASED_EXERCISES.has(normalizedName)) return true;

  if (
    hasRecoveryTag(exercise.goal_tags) &&
    (normalizedName.endsWith('stretch') ||
      normalizedName.endsWith('pose') ||
      normalizedName.includes('foam rolling'))
  ) {
    return true;
  }

  return false;
}

export function showWeightInput(
  exerciseOrEquipment: ExerciseLoggingInput | string | undefined | null,
  name?: string | null
): boolean {
  const exercise = toExerciseLoggingInput(exerciseOrEquipment, name);

  if (isDurationExercise(exercise)) {
    return DURATION_WITH_WEIGHT_EXERCISES.has(normalizeExerciseName(exercise.name));
  }

  return !isBodyweight(exercise.equipment);
}

export function showSecondsInput(
  exerciseOrEquipment: ExerciseLoggingInput | string | undefined | null,
  name?: string | null
): boolean {
  return isDurationExercise(exerciseOrEquipment, name);
}

export function sanitizeDurationInputPart(text: string, maxValue: number): string {
  const digits = text.replace(/\D/g, '').slice(0, 2);
  if (!digits) return '';
  const value = Math.min(parseInt(digits, 10), maxValue);
  return Number.isNaN(value) ? '' : String(value);
}

function parseDurationPart(text: string | undefined | null): number | null {
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const value = parseInt(digits, 10);
  return Number.isNaN(value) ? null : value;
}

export function durationPartsToSeconds(
  minutesText: string | undefined | null,
  secondsText: string | undefined | null
): number | null {
  const minutes = parseDurationPart(minutesText);
  const seconds = parseDurationPart(secondsText);

  if (minutes == null && seconds == null) return null;

  return (minutes ?? 0) * 60 + Math.min(seconds ?? 0, 59);
}

export function secondsToDurationParts(totalSeconds: number | undefined | null): {
  minutes: string;
  seconds: string;
} {
  if (!totalSeconds || totalSeconds <= 0) {
    return { minutes: '', seconds: '' };
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes: minutes > 0 ? String(minutes) : '',
    seconds: seconds > 0 ? String(seconds) : '',
  };
}

export function formatDurationLabel(totalSeconds: number | undefined | null): string {
  if (!totalSeconds || totalSeconds <= 0) return 'Not logged';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
