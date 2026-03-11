/**
 * App stores weight in lbs and height in inches in the DB.
 * When user selects kg/cm, we convert for display and convert back when saving.
 */

const LBS_TO_KG = 0.453592;
const INCHES_TO_CM = 2.54;

export type Units = 'lbs' | 'kg';

/** Convert stored lbs to display value (lbs or kg) - number only */
export function toDisplayWeight(lbs: number | null | undefined, units: Units): string {
  if (lbs == null || Number.isNaN(lbs)) return '—';
  if (units === 'kg') {
    const kg = lbs * LBS_TO_KG;
    return kg >= 100 ? Math.round(kg).toString() : kg.toFixed(1);
  }
  return lbs >= 1000 ? Math.round(lbs).toLocaleString() : String(Math.round(lbs));
}

/** Convert stored lbs to number for display (e.g. for charts or "X kg") */
export function toDisplayWeightNumber(lbs: number | null | undefined, units: Units): number {
  if (lbs == null || Number.isNaN(lbs)) return 0;
  return units === 'kg' ? lbs * LBS_TO_KG : lbs;
}

/** Format weight with unit label */
export function formatWeight(lbs: number | null | undefined, units: Units): string {
  if (lbs == null || Number.isNaN(lbs)) return '—';
  const val = units === 'kg' ? lbs * LBS_TO_KG : lbs;
  const str = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : (units === 'kg' ? val.toFixed(1) : Math.round(val).toString());
  return `${str} ${units}`;
}

/** Format volume (weight × reps sum) with unit */
export function formatVolume(lbs: number | null | undefined, units: Units): string {
  if (lbs == null || Number.isNaN(lbs) || lbs === 0) return '—';
  const val = units === 'kg' ? lbs * LBS_TO_KG : lbs;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}m ${units}`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k ${units}`;
  return `${Math.round(val)} ${units}`;
}

/** Compact volume for cards (e.g. "3.2k lbs") */
export function formatVolumeCompact(lbs: number | null | undefined, units: Units): string {
  if (lbs == null || Number.isNaN(lbs) || lbs === 0) return '';
  const val = units === 'kg' ? lbs * LBS_TO_KG : lbs;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k ${units}`;
  return `${Math.round(val)} ${units}`;
}

/** Convert display input (user entered in kg or lbs) back to lbs for DB */
export function fromDisplayWeight(displayValue: number, units: Units): number {
  if (units === 'kg') return displayValue / LBS_TO_KG;
  return displayValue;
}

/** Stored height is in inches. Return display string (ft-in or cm) */
export function formatHeightInches(inches: number | null | undefined, units: Units): string {
  if (inches == null || Number.isNaN(inches)) return '—';
  if (units === 'kg') {
    const cm = Math.round(inches * INCHES_TO_CM);
    return `${cm} cm`;
  }
  const ft = Math.floor(inches / 12);
  const inRem = Math.round(inches % 12);
  return `${ft}' ${inRem}"`;
}

/** Parse height from display: "70" (inches) or "178" (cm) depending on units */
export function parseHeightDisplay(value: string, units: Units): number | null {
  const n = parseFloat(value);
  if (Number.isNaN(n) || n <= 0) return null;
  if (units === 'kg') return n / INCHES_TO_CM; // cm -> inches for storage
  return n; // already inches
}

/** Parse weight from display (user types in kg or lbs) to lbs for storage */
export function parseWeightDisplay(value: string, units: Units): number | null {
  const n = parseFloat(value);
  if (Number.isNaN(n) || n < 0) return null;
  return fromDisplayWeight(n, units);
}
