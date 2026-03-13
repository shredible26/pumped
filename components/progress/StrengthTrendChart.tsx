import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { format } from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { formatWeight, toDisplayWeightNumber, type Units } from '@/utils/units';
import type {
  StrengthTrendBestMark,
  StrengthTrendPeerComparison,
  StrengthTrendPoint,
} from '@/services/strengthTrends';

interface StrengthTrendChartProps {
  exerciseName: string;
  points: StrengthTrendPoint[];
  actualMax: StrengthTrendBestMark | null;
  peerComparison: StrengthTrendPeerComparison | null;
  units: Units;
}

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  value: number;
}

function formatChartValue(value: number, units: Units): string {
  const rounded = units === 'kg' ? value.toFixed(1) : Math.round(value).toString();
  return `${rounded} ${units}`;
}

function buildLinePath(points: ChartPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function buildAreaPath(points: ChartPoint[], baselineY: number): string {
  if (points.length === 0) return '';
  const linePath = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

function getLabelIndices(length: number): Set<number> {
  if (length <= 4) return new Set(Array.from({ length }, (_, index) => index));

  const every = Math.ceil(length / 4);
  const indices = new Set<number>([0, length - 1]);
  for (let index = every; index < length - 1; index += every) {
    indices.add(index);
  }
  return indices;
}

export default function StrengthTrendChart({
  exerciseName,
  points,
  actualMax,
  peerComparison,
  units,
}: StrengthTrendChartProps) {
  const { width: screenWidth } = useWindowDimensions();

  if (points.length === 0) return null;

  const displayValues = points.map((point) => toDisplayWeightNumber(point.maxWeight, units));
  const maxValue = Math.max(...displayValues);
  const minValue = Math.min(...displayValues);
  const range = maxValue === minValue ? Math.max(maxValue * 0.1, 5) : maxValue - minValue;

  const chartHeight = 220;
  const plotTop = 18;
  const plotBottom = 150;
  const baselineY = plotBottom;
  const chartWidth = Math.max(screenWidth - spacing.xl * 2 - 12, points.length * 72);
  const leftPadding = 18;
  const rightPadding = 18;
  const labelIndices = getLabelIndices(points.length);

  const chartPoints: ChartPoint[] = points.map((point, index) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : leftPadding +
          (index / (points.length - 1)) * (chartWidth - leftPadding - rightPadding);
    const normalized = (toDisplayWeightNumber(point.maxWeight, units) - minValue) / range;
    const y = baselineY - normalized * (baselineY - plotTop - 8);

    return {
      x,
      y,
      label: format(new Date(`${point.sessionDate}T12:00:00`), 'MMM d'),
      value: toDisplayWeightNumber(point.maxWeight, units),
    };
  });

  const latestPoint = points[points.length - 1];
  const firstPoint = points[0];
  const latestDisplay = toDisplayWeightNumber(latestPoint.maxWeight, units);
  const firstDisplay = toDisplayWeightNumber(firstPoint.maxWeight, units);
  const delta = latestDisplay - firstDisplay;
  const deltaColor =
    delta > 0 ? colors.accent.primary : delta < 0 ? '#F97316' : colors.text.secondary;
  const deltaLabel =
    points.length === 1
      ? 'First tracked lift'
      : delta === 0
        ? 'Holding steady'
        : `${delta > 0 ? '+' : ''}${Math.abs(delta).toFixed(units === 'kg' ? 1 : 0)} ${units}`;

  const midGuide = minValue + range / 2;
  const actualBestLabel = actualMax
    ? `${formatWeight(actualMax.weight, units)}${actualMax.reps ? ` x ${actualMax.reps}` : ''}`
    : null;
  const hasCommunityComparison =
    peerComparison != null &&
    peerComparison.participantCount > 1 &&
    peerComparison.rank != null &&
    peerComparison.betterThanPercent != null;
  const rankLabel =
    peerComparison?.rank != null
      ? `#${peerComparison.rank} of ${peerComparison.participantCount}`
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerMetric}>
          <Text style={styles.metricLabel}>Trend</Text>
          <Text style={[styles.metricValue, { color: deltaColor }]}>{deltaLabel}</Text>
        </View>
        <View style={[styles.headerMetric, styles.headerMetricRight]}>
          <Text style={styles.metricLabel}>Tracked sessions</Text>
          <Text style={styles.metricValue}>{points.length}</Text>
        </View>
      </View>

      <View style={styles.chartMetaRow}>
        <Text style={styles.chartTitle}>{exerciseName}</Text>
        <Text style={styles.chartSubtext}>
          Heaviest logged set from each workout session
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContent}
      >
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="strengthTrendFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={colors.accent.primary} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={colors.accent.primary} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {[plotTop, (plotTop + baselineY) / 2, baselineY].map((y, index) => (
            <Line
              key={index}
              x1={leftPadding}
              y1={y}
              x2={chartWidth - rightPadding}
              y2={y}
              stroke="rgba(148, 163, 184, 0.18)"
              strokeDasharray="4 5"
              strokeWidth={1}
            />
          ))}

          <SvgText
            x={leftPadding}
            y={plotTop - 4}
            fill={colors.text.tertiary}
            fontSize="10"
            fontWeight="600"
          >
            {formatChartValue(maxValue, units)}
          </SvgText>
          <SvgText
            x={leftPadding}
            y={(plotTop + baselineY) / 2 - 4}
            fill={colors.text.tertiary}
            fontSize="10"
            fontWeight="600"
          >
            {formatChartValue(midGuide, units)}
          </SvgText>
          <SvgText
            x={leftPadding}
            y={baselineY - 4}
            fill={colors.text.tertiary}
            fontSize="10"
            fontWeight="600"
          >
            {formatChartValue(minValue, units)}
          </SvgText>

          <Path
            d={buildAreaPath(chartPoints, baselineY)}
            fill="url(#strengthTrendFill)"
          />
          <Path
            d={buildLinePath(chartPoints)}
            stroke={colors.accent.primary}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chartPoints.map((point, index) => {
            const isLatest = index === chartPoints.length - 1;

            return (
              <G key={`${point.x}-${point.y}`}>
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={isLatest ? 5.5 : 4}
                  fill={colors.bg.primary}
                  stroke={colors.accent.primary}
                  strokeWidth={isLatest ? 3 : 2}
                />
                {labelIndices.has(index) ? (
                  <SvgText
                    x={point.x}
                    y={chartHeight - 14}
                    fill={colors.text.tertiary}
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {point.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Latest</Text>
        <Text style={styles.footerValue}>
          {formatWeight(latestPoint.maxWeight, units)}
          {latestPoint.reps ? ` x ${latestPoint.reps}` : ''}
        </Text>
      </View>
      <Text style={styles.footerSubtext}>
        {latestPoint.sessionName} on {format(new Date(`${latestPoint.sessionDate}T12:00:00`), 'MMM d, yyyy')}
      </Text>

      {actualBestLabel ? (
        <View style={styles.communityCard}>
          <View style={styles.communityHeader}>
            <Text style={styles.communityEyebrow}>Pumped Ranking</Text>
            <View style={styles.communityChip}>
              <Text style={styles.communityChipText}>Actual max only</Text>
            </View>
          </View>

          {hasCommunityComparison ? (
            <>
              <View style={styles.communityScoreRow}>
                <View style={styles.communityScoreBlock}>
                  <Text style={styles.communityScoreValue}>
                    {peerComparison.betterThanPercent}%
                  </Text>
                  <Text style={styles.communityScoreLabel}>better than Pumped users</Text>
                </View>

                <View style={styles.communityRankPill}>
                  <Text style={styles.communityRankPillLabel}>Rank</Text>
                  <Text style={styles.communityRankPillValue}>{rankLabel}</Text>
                </View>
              </View>

              <Text style={styles.communityBodyText}>
                Your best {actualBestLabel} is stronger than{' '}
                {peerComparison.betterThanPercent}% of Pumped users who have logged{' '}
                {exerciseName}.
              </Text>

              <Text style={styles.communityFootnote}>
                Based on {peerComparison.participantCount} lifter
                {peerComparison.participantCount === 1 ? '' : 's'} with a completed weighted set
                for this exercise.
              </Text>
            </>
          ) : peerComparison?.participantCount === 1 ? (
            <>
              <Text style={styles.communitySoloTitle}>First benchmark on Pumped</Text>
              <Text style={styles.communityBodyText}>
                Your best {actualBestLabel} is currently the only logged max for {exerciseName}.
                Once more people track this lift, your percentile will show here.
              </Text>
            </>
          ) : (
            <Text style={styles.communityBodyText}>
              Your best {actualBestLabel} is ready. Community ranking will appear here once a
              broader benchmark is available for {exerciseName}.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerMetric: {
    flex: 1,
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerMetricRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
  },
  chartMetaRow: {
    marginTop: spacing.lg,
  },
  chartTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chartSubtext: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  chartScrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  footerLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  footerValue: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  footerSubtext: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  communityCard: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.accent.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  communityEyebrow: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  communityChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,15,0.32)',
  },
  communityChipText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  communityScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  communityScoreBlock: {
    flex: 1,
  },
  communityScoreValue: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '800',
    color: colors.text.primary,
  },
  communityScoreLabel: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  communityRankPill: {
    minWidth: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(10,10,15,0.44)',
    alignItems: 'center',
  },
  communityRankPillLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  communityRankPillValue: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
  },
  communitySoloTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  communityBodyText: {
    fontSize: font.sm,
    lineHeight: 20,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  communityFootnote: {
    fontSize: font.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
});
