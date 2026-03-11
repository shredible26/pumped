/**
 * Recovery windows (hours) per muscle — exponential decay uses these as base.
 * quads/glutes/lats: 84h; chest/hamstrings/traps: 60h; delts/arms: 48h; forearms/abs/calves: 36h
 */
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

/**
 * Volume load drives how slowly recovery climbs after a session.
 * Higher effectiveLoad → longer adjusted window → stays red/yellow longer.
 * Coefficient tuned so heavy sessions (3+ primary exercises worth of volume) remain fatigued longer.
 */
const VOLUME_COEFFICIENT = 0.00012;

/**
 * @param asOfDate If provided, recovery is computed as of this date (for historical view). Otherwise uses now.
 */
export function calculateRecovery(
  muscle: string,
  lastTrainedAt: Date,
  volumeLoad: number,
  asOfDate?: Date,
): number {
  const toTime = (asOfDate ?? new Date()).getTime();
  const hoursElapsed = (toTime - lastTrainedAt.getTime()) / 3600000;
  const baseHours = RECOVERY_HOURS[muscle] || 60;
  const adjusted = baseHours * (1 + Math.max(0, volumeLoad) * VOLUME_COEFFICIENT);
  const pct = Math.min(100, (1 - Math.exp((-3 * hoursElapsed) / adjusted)) * 100);
  return Math.round(pct);
}
