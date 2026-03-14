import { Exercise } from '@/types/exercise';

export interface ExercisePickerSection {
  key: string;
  title: string;
  kind: 'recommended' | 'group';
  subtitle?: string;
  exercises: Exercise[];
}

type RecommendationType =
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'cardio'
  | 'aesthetic'
  | 'ai_optimal'
  | 'workout';

const RECOMMENDED_LIMIT = 7;

const DIFFICULTY_ORDER: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const RECOMMENDED_EXERCISE_NAMES: Record<RecommendationType, string[]> = {
  push: [
    'Barbell Bench Press',
    'Incline Dumbbell Press',
    'Overhead Press (Barbell)',
    'Machine Chest Press',
    'Dumbbell Lateral Raise',
    'Tricep Rope Pushdown',
    'Cable Flyes',
    'Dips',
  ],
  pull: [
    'Pull-Ups',
    'Lat Pulldown',
    'Barbell Row',
    'Seated Cable Row',
    'Chest-Supported Dumbbell Row',
    'Face Pulls',
    'Hammer Curl',
    'Barbell Curl',
  ],
  legs: [
    'Barbell Back Squat',
    'Romanian Deadlift',
    'Leg Press',
    'Bulgarian Split Squat',
    'Seated Leg Curl',
    'Hip Thrust (Barbell)',
    'Standing Calf Raise (Machine)',
    'Cable Crunch',
  ],
  upper: [
    'Barbell Bench Press',
    'Pull-Ups',
    'Incline Dumbbell Press',
    'Seated Cable Row',
    'Dumbbell Shoulder Press',
    'Dumbbell Lateral Raise',
    'Hammer Curl',
    'Tricep Rope Pushdown',
  ],
  lower: [
    'Barbell Back Squat',
    'Romanian Deadlift',
    'Leg Press',
    'Bulgarian Split Squat',
    'Seated Leg Curl',
    'Hip Thrust (Barbell)',
    'Standing Calf Raise (Machine)',
    'Cable Crunch',
  ],
  cardio: [
    'Treadmill (Incline Walk)',
    'Stationary Bike',
    'Rowing Machine',
    'Elliptical',
    'Stairmaster',
    'Walking',
    'Jump Rope',
    'Assault Bike',
  ],
  aesthetic: [
    'Incline Dumbbell Press',
    'Wide-Grip Lat Pulldown',
    'Seated Cable Row',
    'Seated Dumbbell Shoulder Press',
    'Dumbbell Lateral Raise',
    'Bayesian Cable Curl',
    'Overhead Tricep Extension (Cable)',
    'Cable Flyes',
  ],
  ai_optimal: [
    'Barbell Bench Press',
    'Pull-Ups',
    'Barbell Back Squat',
    'Romanian Deadlift',
    'Dumbbell Shoulder Press',
    'Seated Cable Row',
    'Dumbbell Lateral Raise',
    'Cable Crunch',
  ],
  workout: [
    'Barbell Bench Press',
    'Lat Pulldown',
    'Barbell Back Squat',
    'Romanian Deadlift',
    'Dumbbell Shoulder Press',
    'Seated Cable Row',
    'Cable Crunch',
    'Tricep Rope Pushdown',
  ],
};

const TARGET_MUSCLES: Record<RecommendationType, string[]> = {
  push: ['chest', 'front_delts', 'side_delts', 'triceps'],
  pull: ['lats', 'traps', 'rear_delts', 'biceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  upper: ['chest', 'lats', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  cardio: ['cardio'],
  aesthetic: ['chest', 'lats', 'side_delts', 'rear_delts', 'biceps', 'triceps'],
  ai_optimal: ['chest', 'lats', 'quads', 'hamstrings', 'front_delts', 'side_delts', 'abs'],
  workout: ['chest', 'lats', 'quads', 'hamstrings', 'front_delts', 'side_delts', 'biceps', 'triceps'],
};

const PATTERN_PRIORITY: Record<RecommendationType, string[]> = {
  push: ['horizontal_push', 'vertical_push', 'isolation_push'],
  pull: ['vertical_pull', 'horizontal_pull', 'isolation_pull'],
  legs: ['squat', 'hip_hinge', 'lunge', 'core'],
  upper: ['horizontal_push', 'vertical_pull', 'horizontal_pull', 'vertical_push', 'isolation_push', 'isolation_pull'],
  lower: ['squat', 'hip_hinge', 'lunge', 'core'],
  cardio: ['cardio'],
  aesthetic: ['horizontal_push', 'vertical_pull', 'horizontal_pull', 'vertical_push', 'isolation_push', 'isolation_pull'],
  ai_optimal: ['squat', 'horizontal_push', 'vertical_pull', 'hip_hinge', 'horizontal_pull', 'vertical_push', 'core'],
  workout: ['horizontal_push', 'vertical_pull', 'squat', 'hip_hinge', 'horizontal_pull', 'vertical_push', 'core'],
};

const RECOMMENDATION_SUBTITLES: Record<RecommendationType, string> = {
  push: 'Common push-day staples for chest, shoulders, and triceps.',
  pull: 'Common pull-day staples for back, rear delts, and arms.',
  legs: 'Common leg-day staples for quads, glutes, hamstrings, and calves.',
  upper: 'Balanced upper-body staples to start with.',
  lower: 'Balanced lower-body staples to start with.',
  cardio: 'Simple cardio go-tos for active recovery or conditioning.',
  aesthetic: 'Hypertrophy-friendly picks that fit the aesthetic flow.',
  ai_optimal: 'Balanced all-around staples for a strong AI-guided session.',
  workout: 'Common gym staples to get a workout started quickly.',
};

export function buildExercisePickerSections(
  exercises: Exercise[],
  workoutType?: string | null,
  options?: { includeRecommended?: boolean }
): ExercisePickerSection[] {
  const sortedExercises = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
  const sections: ExercisePickerSection[] = [];

  if (options?.includeRecommended !== false) {
    const recommended = getRecommendedExercises(sortedExercises, workoutType);
    if (recommended.length > 0) {
      const recommendationType = normalizeRecommendationType(workoutType);
      sections.push({
        key: 'recommended',
        title: 'Recommended',
        kind: 'recommended',
        subtitle: RECOMMENDATION_SUBTITLES[recommendationType],
        exercises: recommended,
      });
    }
  }

  const groups = new Map<string, Exercise[]>();
  for (const exercise of sortedExercises) {
    const key = exercise.primary_muscle || 'other';
    const list = groups.get(key) ?? [];
    list.push(exercise);
    groups.set(key, list);
  }

  const groupSections = Array.from(groups.entries())
    .sort(([a], [b]) => formatExerciseGroupLabel(a).localeCompare(formatExerciseGroupLabel(b)))
    .map(([key, list]) => ({
      key,
      title: formatExerciseGroupLabel(key),
      kind: 'group' as const,
      exercises: list,
    }));

  return [...sections, ...groupSections];
}

export function formatExerciseGroupLabel(group: string): string {
  return group
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRecommendedExercises(exercises: Exercise[], workoutType?: string | null): Exercise[] {
  const recommendationType = normalizeRecommendationType(workoutType);
  const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]));
  const selected = new Map<string, Exercise>();

  for (const name of RECOMMENDED_EXERCISE_NAMES[recommendationType]) {
    const match = byName.get(name);
    if (match) selected.set(match.id, match);
    if (selected.size >= RECOMMENDED_LIMIT) {
      return Array.from(selected.values());
    }
  }

  const targetMuscles = TARGET_MUSCLES[recommendationType];
  const patternOrder = PATTERN_PRIORITY[recommendationType];

  const fallback = exercises
    .filter((exercise) => {
      if (selected.has(exercise.id)) return false;
      if (exercise.fatigue_rating <= 0) return false;
      if (!targetMuscles.includes(exercise.primary_muscle)) return false;
      return true;
    })
    .sort((left, right) => {
      const muscleDelta =
        targetMuscles.indexOf(left.primary_muscle) - targetMuscles.indexOf(right.primary_muscle);
      if (muscleDelta !== 0) return muscleDelta;

      const patternDelta =
        getPatternRank(left.movement_pattern, patternOrder) -
        getPatternRank(right.movement_pattern, patternOrder);
      if (patternDelta !== 0) return patternDelta;

      const bigThreeDelta = Number(right.is_big_three) - Number(left.is_big_three);
      if (bigThreeDelta !== 0) return bigThreeDelta;

      const difficultyDelta =
        (DIFFICULTY_ORDER[left.difficulty] ?? 99) - (DIFFICULTY_ORDER[right.difficulty] ?? 99);
      if (difficultyDelta !== 0) return difficultyDelta;

      return left.name.localeCompare(right.name);
    });

  for (const exercise of fallback) {
    selected.set(exercise.id, exercise);
    if (selected.size >= RECOMMENDED_LIMIT) break;
  }

  return Array.from(selected.values());
}

function getPatternRank(pattern: string, patternOrder: string[]): number {
  const rank = patternOrder.indexOf(pattern);
  return rank === -1 ? patternOrder.length : rank;
}

function normalizeRecommendationType(workoutType?: string | null): RecommendationType {
  const value = String(workoutType ?? '')
    .trim()
    .toLowerCase();

  if (value.includes('push')) return 'push';
  if (value.includes('pull')) return 'pull';
  if (value.includes('leg')) return 'legs';
  if (value.includes('upper')) return 'upper';
  if (value.includes('lower')) return 'lower';
  if (value.includes('cardio') || value.includes('rest') || value.includes('recovery')) return 'cardio';
  if (value.includes('aesthetic')) return 'aesthetic';
  if (value.includes('ai_optimal') || value.includes('ai optimal') || value.includes('ai_decides')) {
    return 'ai_optimal';
  }

  return 'workout';
}
