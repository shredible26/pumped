/**
 * Generates a short, intuitive workout name from exercise/muscle data when the user doesn't set one.
 * Used for Past Workouts and session display.
 */

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  core: 'Core',
  abs: 'Core',
  traps: 'Traps',
  forearms: 'Forearms',
  calves: 'Calves',
};

/** Map primary_muscle (lowercase) to a short label for combo names */
function normalizeMuscle(m: string | null | undefined): string | null {
  if (!m || typeof m !== 'string') return null;
  const key = m.toLowerCase().replace(/\s+/g, '_');
  return MUSCLE_LABELS[key] ?? (m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
}

/**
 * Build a concise name from primary muscles (e.g. "Back + Biceps", "Upper Body").
 */
export function generateWorkoutNameFromMuscles(
  primaryMuscles: (string | null | undefined)[]
): string {
  const set = new Set<string>();
  primaryMuscles.forEach((m) => {
    const label = normalizeMuscle(m);
    if (label) set.add(label);
  });
  const list = [...set].filter(Boolean);
  if (list.length === 0) return 'Workout';
  if (list.length === 1) return `${list[0]} Workout`;
  if (list.length === 2) return `${list[0]} + ${list[1]}`;
  const upper = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Traps', 'Forearms', 'Core'];
  const lower = ['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'];
  const hasUpper = list.some((l) => upper.includes(l));
  const hasLower = list.some((l) => lower.includes(l));
  if (hasUpper && hasLower) return 'Full Body';
  if (hasUpper) return 'Upper Body';
  if (hasLower) return 'Lower Body';
  return list.slice(0, 2).join(' + ');
}

/**
 * Generate a short name from a list of exercises (each with primary_muscle or name).
 */
export function generateWorkoutNameFromExercises(
  exercises: { primary_muscle?: string | null; name?: string }[]
): string {
  const muscles = exercises.map((e) => e.primary_muscle ?? inferMuscleFromName(e.name));
  return generateWorkoutNameFromMuscles(muscles);
}

function inferMuscleFromName(name: string | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('squat') || n.includes('leg press') || n.includes('lunge')) return 'legs';
  if (n.includes('deadlift') || n.includes('row') || n.includes('pull')) return 'back';
  if (n.includes('bench') || n.includes('press') && n.includes('chest')) return 'chest';
  if (n.includes('overhead') || n.includes('shoulder')) return 'shoulders';
  if (n.includes('curl') && n.includes('bicep')) return 'biceps';
  if (n.includes('tricep') || n.includes('pushdown')) return 'triceps';
  if (n.includes('plank') || n.includes('ab') || n.includes('core')) return 'core';
  return null;
}
