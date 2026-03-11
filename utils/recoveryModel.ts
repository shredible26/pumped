// utils/recoveryModel.ts
// Scientific Muscle Readiness Model for Pumped
// Based on: fiber type composition, voluntary activation levels,
// volume-load relationships, and exponential recovery curves

// ═══════════════════════════════════════════════════════════
// MUSCLE GROUP PROPERTIES (from exercise science research)
// ═══════════════════════════════════════════════════════════

interface MuscleProperties {
  fastTwitchPct: number;
  voluntaryActivation: number;
  baseRecoveryHours: number;
  sizeCategory: 'large' | 'medium' | 'small';
}

export const MUSCLE_PROPERTIES: Record<string, MuscleProperties> = {
  chest:       { fastTwitchPct: 0.65, voluntaryActivation: 0.95, baseRecoveryHours: 72, sizeCategory: 'large' },
  lats:        { fastTwitchPct: 0.50, voluntaryActivation: 0.70, baseRecoveryHours: 60, sizeCategory: 'large' },
  traps:       { fastTwitchPct: 0.50, voluntaryActivation: 0.65, baseRecoveryHours: 48, sizeCategory: 'medium' },
  front_delts: { fastTwitchPct: 0.40, voluntaryActivation: 0.80, baseRecoveryHours: 48, sizeCategory: 'small' },
  side_delts:  { fastTwitchPct: 0.40, voluntaryActivation: 0.75, baseRecoveryHours: 44, sizeCategory: 'small' },
  rear_delts:  { fastTwitchPct: 0.40, voluntaryActivation: 0.70, baseRecoveryHours: 40, sizeCategory: 'small' },
  biceps:      { fastTwitchPct: 0.62, voluntaryActivation: 0.95, baseRecoveryHours: 72, sizeCategory: 'small' },
  triceps:     { fastTwitchPct: 0.57, voluntaryActivation: 0.95, baseRecoveryHours: 68, sizeCategory: 'small' },
  forearms:    { fastTwitchPct: 0.50, voluntaryActivation: 0.80, baseRecoveryHours: 36, sizeCategory: 'small' },
  abs:         { fastTwitchPct: 0.45, voluntaryActivation: 0.70, baseRecoveryHours: 36, sizeCategory: 'medium' },
  quads:       { fastTwitchPct: 0.50, voluntaryActivation: 0.40, baseRecoveryHours: 48, sizeCategory: 'large' },
  hamstrings:  { fastTwitchPct: 0.55, voluntaryActivation: 0.60, baseRecoveryHours: 56, sizeCategory: 'large' },
  glutes:      { fastTwitchPct: 0.50, voluntaryActivation: 0.50, baseRecoveryHours: 52, sizeCategory: 'large' },
  calves:      { fastTwitchPct: 0.25, voluntaryActivation: 0.70, baseRecoveryHours: 28, sizeCategory: 'medium' },
};

// ═══════════════════════════════════════════════════════════
// EXERCISE STRAIN MULTIPLIERS
// ═══════════════════════════════════════════════════════════

export const MOVEMENT_STRAIN_MULTIPLIER: Record<string, number> = {
  horizontal_push: 1.3,
  horizontal_pull: 1.2,
  vertical_push: 1.2,
  vertical_pull: 1.2,
  hip_hinge: 1.4,
  squat: 1.35,
  lunge: 1.15,
  isolation_push: 0.8,
  isolation_pull: 0.8,
  isolation: 0.8,
  core: 0.7,
  cardio: 0.3,
};

// ═══════════════════════════════════════════════════════════
// STRAIN CALCULATION
// ═══════════════════════════════════════════════════════════

export interface SetData {
  weight: number;
  reps: number;
  exerciseMovementPattern: string;
  isPrimaryMuscle: boolean;
  exerciseId?: string;
}

export function calculateMuscleStrain(
  muscleGroup: string,
  setsForThisMuscle: SetData[]
): number {
  if (setsForThisMuscle.length === 0) return 0;

  const props = MUSCLE_PROPERTIES[muscleGroup];
  if (!props) return 0;

  let totalStrain = 0;

  for (const set of setsForThisMuscle) {
    const volumeLoad = set.weight * set.reps;
    const movementMultiplier = MOVEMENT_STRAIN_MULTIPLIER[set.exerciseMovementPattern] ?? 0.8;
    const targetMultiplier = set.isPrimaryMuscle ? 1.0 : 0.4;
    const repFatigueFactor = set.reps <= 5 ? 0.8 : set.reps <= 8 ? 1.0 : set.reps <= 12 ? 1.15 : 1.3;
    const fiberSusceptibility = 0.7 + props.fastTwitchPct * 0.6;
    const activationFactor = 0.6 + props.voluntaryActivation * 0.5;

    const setStrain = volumeLoad * movementMultiplier * targetMultiplier *
      repFatigueFactor * fiberSusceptibility * activationFactor;

    totalStrain += setStrain;
  }

  const sizeNormalizer = props.sizeCategory === 'large' ? 15000 :
    props.sizeCategory === 'medium' ? 10000 : 7000;

  const uniqueExercises = new Set(
    setsForThisMuscle.map((s) => s.exerciseId).filter(Boolean)
  ).size;
  const exerciseCountMultiplier = uniqueExercises >= 3 ? 1.2 : 1.0;

  const normalizedStrain = Math.min(100, (totalStrain / sizeNormalizer) * 100 * exerciseCountMultiplier);

  return Math.round(normalizedStrain);
}

// ═══════════════════════════════════════════════════════════
// RECOVERY CALCULATION
// ═══════════════════════════════════════════════════════════

export function calculateReadiness(
  muscleGroup: string,
  strainApplied: number,
  hoursSinceWorkout: number
): number {
  if (strainApplied === 0) return 100;
  if (hoursSinceWorkout <= 0) return Math.max(0, 100 - strainApplied);

  const props = MUSCLE_PROPERTIES[muscleGroup];
  if (!props) return 100;

  const k = 2.303 / props.baseRecoveryHours;
  const remainingFatigue = strainApplied * Math.exp(-k * hoursSinceWorkout);
  const readiness = Math.max(0, Math.min(100, 100 - remainingFatigue));

  return Math.round(readiness);
}

// ═══════════════════════════════════════════════════════════
// MULTI-WORKOUT ACCUMULATION
// ═══════════════════════════════════════════════════════════

export interface WorkoutStrain {
  strain: number;
  completedAt: Date;
}

export function calculateCumulativeReadiness(
  muscleGroup: string,
  workoutStrains: WorkoutStrain[],
  atTime: Date = new Date()
): number {
  if (workoutStrains.length === 0) return -1;

  let totalResidualFatigue = 0;

  for (const ws of workoutStrains) {
    const hoursSince = (atTime.getTime() - ws.completedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 0) continue;

    const props = MUSCLE_PROPERTIES[muscleGroup];
    if (!props) continue;

    const k = 2.303 / props.baseRecoveryHours;
    const residual = ws.strain * Math.exp(-k * hoursSince);
    totalResidualFatigue += residual;
  }

  const readiness = Math.max(0, Math.min(100, 100 - totalResidualFatigue));
  return Math.round(readiness);
}

// ═══════════════════════════════════════════════════════════
// COLOR MAPPING
// ═══════════════════════════════════════════════════════════

export function getReadinessColor(readiness: number | null): string {
  if (readiness === null || readiness === -1) return '#3A3A4A';
  if (readiness >= 80) return '#4ADE80';
  if (readiness >= 60) return '#86EFAC';
  if (readiness >= 30) return '#FACC15';
  return '#EF4444';
}

export function getReadinessStatus(readiness: number | null): string {
  if (readiness === null || readiness === -1) return 'No data yet';
  if (readiness >= 80) return 'Ready for heavy work';
  if (readiness >= 60) return 'Mostly recovered — normal training OK';
  if (readiness >= 30) return 'Moderate fatigue — reduce volume';
  return 'Fatigued — avoid or go very light';
}

export function getReadinessBgColor(readiness: number | null): string {
  if (readiness === null || readiness === -1) return 'rgba(58,58,74,0.12)';
  if (readiness >= 80) return 'rgba(74,222,128,0.12)';
  if (readiness >= 60) return 'rgba(134,239,172,0.12)';
  if (readiness >= 30) return 'rgba(250,204,21,0.12)';
  return 'rgba(239,68,68,0.12)';
}

// Legacy: old hook expected calculateRecovery(muscle, lastTrainedAt, volumeLoad, asOfDate)
export function calculateRecovery(
  muscle: string,
  lastTrainedAt: Date,
  volumeLoad: number,
  asOfDate?: Date
): number {
  const toTime = (asOfDate ?? new Date()).getTime();
  const hoursSince = (toTime - lastTrainedAt.getTime()) / 3600000;
  const props = MUSCLE_PROPERTIES[muscle];
  if (!props) return 100;
  const k = 2.303 / props.baseRecoveryHours;
  const strainFromVolume = Math.min(100, (volumeLoad / 10000) * 50);
  const remaining = strainFromVolume * Math.exp(-k * hoursSince);
  return Math.round(Math.max(0, Math.min(100, 100 - remaining)));
}
