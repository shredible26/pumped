const ACTIVE_WORKOUT_KEY = 'active_workout';

const memoryStore: Record<string, string> = {};

export function saveActiveWorkout(state: any): void {
  try {
    memoryStore[ACTIVE_WORKOUT_KEY] = JSON.stringify(state);
  } catch {}
}

export function loadActiveWorkout(): any | null {
  const raw = memoryStore[ACTIVE_WORKOUT_KEY];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearActiveWorkout(): void {
  delete memoryStore[ACTIVE_WORKOUT_KEY];
}
