export const colors = {
  bg: {
    primary: '#0A0A0F',
    card: '#151520',
    input: 'rgba(255,255,255,0.06)',
  },
  accent: {
    primary: '#4ADE80',
    dim: '#22C55E',
    bg: 'rgba(74,222,128,0.12)',
    border: 'rgba(74,222,128,0.20)',
  },
  recovery: {
    ready: '#4ADE80',
    moderate: '#FACC15',
    fatigued: '#EF4444',
    noData: '#3A3A4A',
  },
  text: {
    primary: '#F5F5F5',
    secondary: '#9CA3AF',
    tertiary: '#6B7280',
    inverse: '#0A0A0F',
  },
  border: {
    default: 'rgba(255,255,255,0.06)',
    light: 'rgba(255,255,255,0.10)',
  },
  error: '#EF4444',
  program: {
    ppl: '#8B5CF6',
    upper_lower: '#3B82F6',
    aesthetic: '#EC4899',
    ai_optimal: '#4ADE80',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const font = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 42,
};

export function recoveryColor(pct: number | null): string {
  if (pct === null || pct === undefined) return colors.recovery.noData;
  if (pct >= 80) return colors.recovery.ready;
  if (pct >= 50) return colors.recovery.moderate;
  return colors.recovery.fatigued;
}
