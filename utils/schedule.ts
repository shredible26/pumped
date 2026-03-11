/**
 * Shared schedule logic: which days are workout days and what type (Push, Pull, etc.)
 * Used by the home screen and RoutineTimeline so they stay in sync.
 */

/** Which weekdays (0=Sun … 6=Sat) are workout days for a given days-per-week. */
export function getWorkoutDayIndices(trainingFrequency: number): number[] {
  const freq = Math.min(6, Math.max(0, Math.floor(trainingFrequency)) || 4);
  switch (freq) {
    case 3:
      return [1, 3, 5]; // Mon, Wed, Fri
    case 4:
      return [1, 2, 4, 5]; // Mon, Tue, Thu, Fri
    case 5:
      return [1, 2, 3, 4, 5]; // Mon–Fri
    case 6:
      return [1, 2, 3, 4, 5, 6]; // Mon–Sat
    default:
      return [1, 2, 4, 5];
  }
}

export type ProgramStyle = 'ppl' | 'upper_lower' | 'aesthetic' | 'ai_optimal';

/** Scheduled workout type for a date based on program_style and training_frequency. */
export function getWorkoutTypeForDate(
  programStyle: ProgramStyle | string | undefined,
  date: Date,
  trainingFrequency: number
): string {
  const dayOfWeek = date.getDay();
  const workoutDays = getWorkoutDayIndices(trainingFrequency);
  const workoutIndex = workoutDays.indexOf(dayOfWeek);
  if (workoutIndex === -1) return 'Rest';

  switch (programStyle) {
    case 'ppl':
      return ['Push', 'Pull', 'Legs'][workoutIndex % 3] ?? 'Push';
    case 'upper_lower':
      return workoutIndex % 2 === 0 ? 'Upper' : 'Lower';
    case 'aesthetic':
    case 'ai_optimal':
      return 'AI Workout';
    default:
      return 'Workout';
  }
}
