const RECOVERY_HOURS: Record<string, number> = {
  quads: 84,
  glutes: 84,
  lats: 84,
  hamstrings: 60,
  chest: 60,
  traps: 60,
  front_delts: 48,
  side_delts: 48,
  rear_delts: 48,
  triceps: 48,
  biceps: 48,
  forearms: 36,
  abs: 36,
  calves: 36,
};

export function calculateRecovery(
  muscle: string,
  lastTrainedAt: Date,
  volumeLoad: number,
): number {
  const hoursElapsed = (Date.now() - lastTrainedAt.getTime()) / 3600000;
  const baseHours = RECOVERY_HOURS[muscle] || 60;
  const adjusted = baseHours * (1 + volumeLoad * 0.00005);
  const pct = Math.min(100, (1 - Math.exp((-3 * hoursElapsed) / adjusted)) * 100);
  return Math.round(pct);
}
