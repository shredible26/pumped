/**
 * Parse a date-only string (yyyy-MM-dd) as local calendar date.
 * Avoids timezone shift: new Date("2025-03-08") is UTC midnight → previous day in US zones.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Today's date as yyyy-MM-dd in the user's local timezone (for logging sessions). */
export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
