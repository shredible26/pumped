import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import Svg, { Path, Ellipse, Rect, G } from 'react-native-svg';
import { colors, font, spacing, radius } from '@/utils/theme';
import { getReadinessColor } from '@/utils/recoveryModel';

interface MuscleData {
  muscle_group: string;
  recovery_pct: number | null;
  last_trained_at: string | null;
}

interface BodyMapProps {
  fatigueMap: MuscleData[];
  onSelectMuscle: (muscle: string) => void;
}

const BODY_W = 150;
const BODY_H = 320;

type MuscleRegion = {
  muscle: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

const FRONT_MUSCLES: MuscleRegion[] = [
  { muscle: 'front_delts', cx: 28, cy: 72, rx: 14, ry: 12 },
  { muscle: 'front_delts', cx: 122, cy: 72, rx: 14, ry: 12 },
  { muscle: 'chest', cx: 55, cy: 88, rx: 22, ry: 14 },
  { muscle: 'chest', cx: 95, cy: 88, rx: 22, ry: 14 },
  { muscle: 'biceps', cx: 18, cy: 112, rx: 10, ry: 20 },
  { muscle: 'biceps', cx: 132, cy: 112, rx: 10, ry: 20 },
  { muscle: 'forearms', cx: 12, cy: 152, rx: 8, ry: 22 },
  { muscle: 'forearms', cx: 138, cy: 152, rx: 8, ry: 22 },
  { muscle: 'abs', cx: 75, cy: 128, rx: 18, ry: 26 },
  { muscle: 'quads', cx: 58, cy: 200, rx: 16, ry: 36 },
  { muscle: 'quads', cx: 92, cy: 200, rx: 16, ry: 36 },
];

const BACK_MUSCLES: MuscleRegion[] = [
  { muscle: 'traps', cx: 75, cy: 62, rx: 22, ry: 14 },
  { muscle: 'rear_delts', cx: 28, cy: 76, rx: 14, ry: 10 },
  { muscle: 'rear_delts', cx: 122, cy: 76, rx: 14, ry: 10 },
  { muscle: 'triceps', cx: 18, cy: 112, rx: 10, ry: 20 },
  { muscle: 'triceps', cx: 132, cy: 112, rx: 10, ry: 20 },
  { muscle: 'lats', cx: 50, cy: 105, rx: 18, ry: 24 },
  { muscle: 'lats', cx: 100, cy: 105, rx: 18, ry: 24 },
  { muscle: 'glutes', cx: 60, cy: 162, rx: 16, ry: 14 },
  { muscle: 'glutes', cx: 90, cy: 162, rx: 16, ry: 14 },
  { muscle: 'hamstrings', cx: 58, cy: 200, rx: 14, ry: 30 },
  { muscle: 'hamstrings', cx: 92, cy: 200, rx: 14, ry: 30 },
  { muscle: 'calves', cx: 56, cy: 258, rx: 10, ry: 22 },
  { muscle: 'calves', cx: 94, cy: 258, rx: 10, ry: 22 },
];

const BODY_OUTLINE_FRONT = `
  M75 16 C60 16 52 22 52 32 L52 42 C52 48 55 52 60 56
  C46 58 32 62 28 68 C22 76 14 90 10 110
  C6 130 4 150 4 170 L8 178 C12 172 16 166 20 158
  C24 148 28 140 30 132 C32 126 36 118 40 112
  L40 148 C42 156 44 164 48 172
  C48 180 48 188 50 196 C52 210 54 228 56 246
  C57 256 58 266 58 276 C58 282 60 288 62 292
  L88 292 C90 288 92 282 92 276
  C92 266 93 256 94 246 C96 228 98 210 100 196
  C102 188 102 180 102 172 C106 164 108 156 110 148
  L110 112 C114 118 118 126 120 132
  C122 140 126 148 130 158 C134 166 138 172 142 178
  L146 170 C146 150 144 130 140 110
  C136 90 128 76 122 68 C118 62 104 58 90 56
  C95 52 98 48 98 42 L98 32 C98 22 90 16 75 16 Z
`;

const BODY_OUTLINE_BACK = `
  M75 16 C60 16 52 22 52 32 L52 42 C52 48 55 52 60 56
  C46 58 32 62 28 68 C22 76 14 90 10 110
  C6 130 4 150 4 170 L8 178 C12 172 16 166 20 158
  C24 148 28 140 30 132 C32 126 36 118 40 112
  L40 148 C42 156 44 164 48 172
  C48 180 48 188 50 196 C52 210 54 228 56 246
  C57 256 58 266 58 276 C58 282 60 288 62 292
  L88 292 C90 288 92 282 92 276
  C92 266 93 256 94 246 C96 228 98 210 100 196
  C102 188 102 180 102 172 C106 164 108 156 110 148
  L110 112 C114 118 118 126 120 132
  C122 140 126 148 130 158 C134 166 138 172 142 178
  L146 170 C146 150 144 130 140 110
  C136 90 128 76 122 68 C118 62 104 58 90 56
  C95 52 98 48 98 42 L98 32 C98 22 90 16 75 16 Z
`;

function getRecovery(fatigueMap: MuscleData[], muscle: string): number | null {
  const entry = fatigueMap.find((m) => m.muscle_group === muscle);
  if (!entry) return null;
  const pct = entry.recovery_pct;
  return pct === -1 ? null : pct;
}

function MuscleEllipse({
  region,
  recovery,
  onPress,
}: {
  region: MuscleRegion;
  recovery: number | null;
  onPress: () => void;
}) {
  const color = getReadinessColor(recovery);
  const isNoData = recovery === null || recovery === undefined;
  return (
    <Ellipse
      cx={region.cx}
      cy={region.cy}
      rx={region.rx}
      ry={region.ry}
      fill={color}
      fillOpacity={isNoData ? 0.25 : 0.45}
      stroke={color}
      strokeWidth={isNoData ? 0.8 : 1.2}
      strokeOpacity={isNoData ? 0.4 : 0.7}
      onPress={onPress}
    />
  );
}

export default function BodyMap({ fatigueMap, onSelectMuscle }: BodyMapProps) {
  const renderedFront = new Set<string>();
  const renderedBack = new Set<string>();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.viewLabel}>FRONT</Text>
        <Text style={styles.viewLabel}>BACK</Text>
      </View>

      <View style={styles.bodyRow}>
        <Svg
          width={BODY_W}
          height={BODY_H}
          viewBox={`0 0 ${BODY_W} ${BODY_H}`}
        >
          <Path
            d={BODY_OUTLINE_FRONT}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={1}
          />
          {FRONT_MUSCLES.map((region, i) => {
            const recovery = getRecovery(fatigueMap, region.muscle);
            return (
              <MuscleEllipse
                key={`front-${i}`}
                region={region}
                recovery={recovery}
                onPress={() => onSelectMuscle(region.muscle)}
              />
            );
          })}
        </Svg>

        <Svg
          width={BODY_W}
          height={BODY_H}
          viewBox={`0 0 ${BODY_W} ${BODY_H}`}
        >
          <Path
            d={BODY_OUTLINE_BACK}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={1}
          />
          {BACK_MUSCLES.map((region, i) => {
            const recovery = getRecovery(fatigueMap, region.muscle);
            return (
              <MuscleEllipse
                key={`back-${i}`}
                region={region}
                recovery={recovery}
                onPress={() => onSelectMuscle(region.muscle)}
              />
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.recovery.ready }]} />
          <Text style={styles.legendText}>Ready</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.recovery.moderate }]} />
          <Text style={styles.legendText}>Moderate</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.recovery.fatigued }]} />
          <Text style={styles.legendText}>Fatigued</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.recovery.noData }]} />
          <Text style={styles.legendText}>No data</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    width: BODY_W * 2 + spacing.lg,
    justifyContent: 'space-around',
    marginBottom: spacing.xs,
  },
  viewLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 1.5,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: font.xs,
    color: colors.text.secondary,
  },
});
