import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek, isToday, isBefore, startOfDay } from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { getWorkoutTypeForDate } from '@/utils/schedule';

type ProgramStyle = 'ppl' | 'upper_lower' | 'aesthetic' | 'ai_optimal';

/** Mon–Sun labels; index 0 = Monday when weekStartsOn: 1 */
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface RoutineTimelineProps {
  programStyle: ProgramStyle | undefined;
  trainingFrequency: number;
  /** Dates (yyyy-MM-dd) this week where user logged a workout, rest, or cardio */
  activityDaysThisWeek: string[];
}

export default function RoutineTimeline({
  programStyle,
  trainingFrequency,
  activityDaysThisWeek,
}: RoutineTimelineProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const today = startOfDay(new Date());

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
        <Text style={styles.headerText}>THIS WEEK'S PLAN</Text>
      </View>
      <View style={styles.timelineRow}>
        <View style={styles.line} />
        {DAY_LABELS.map((dayLetter, i) => {
          const date = addDays(weekStart, i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const typeLabel = getWorkoutTypeForDate(programStyle, date, trainingFrequency);
          const isRest = typeLabel === 'Rest';
          const isDayToday = isToday(date);
          const isPast = isBefore(startOfDay(date), today);
          const isFuture = !isDayToday && !isPast;
          const wasLogged = activityDaysThisWeek.includes(dateStr);

          return (
            <View key={i} style={styles.nodeWrapper}>
              <Text style={styles.dayLetter}>{dayLetter}</Text>
              <View
                style={[
                  styles.node,
                  isDayToday && styles.nodeToday,
                  !isDayToday && wasLogged && styles.nodeLoggedCheck,
                  !isDayToday && !wasLogged && styles.nodeOutline,
                  isRest && !isDayToday && styles.nodeRest,
                ]}
              >
                {isPast && wasLogged && (
                  <Ionicons name="checkmark" size={14} color={colors.accent.primary} />
                )}
              </View>
              <Text
                style={[
                  styles.typeLabel,
                  isRest && styles.typeLabelRest,
                  isDayToday && styles.typeLabelToday,
                ]}
                numberOfLines={1}
              >
                {typeLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const NODE_SIZE = 28;
const NODE_SIZE_TODAY = 34;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 88,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    top: 26,
    height: 2,
    backgroundColor: colors.border.default,
    zIndex: 0,
  },
  nodeWrapper: {
    alignItems: 'center',
    flex: 1,
    zIndex: 1,
  },
  dayLetter: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: colors.bg.primary,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeToday: {
    width: NODE_SIZE_TODAY,
    height: NODE_SIZE_TODAY,
    borderRadius: NODE_SIZE_TODAY / 2,
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
    borderWidth: 2,
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  nodeLoggedCheck: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.light,
  },
  nodeOutline: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.light,
  },
  nodeRest: {
    borderStyle: 'dashed',
  },
  typeLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 2,
    maxWidth: 36,
    textAlign: 'center',
  },
  typeLabelRest: {
    color: colors.text.tertiary,
  },
  typeLabelToday: {
    color: colors.accent.primary,
    fontWeight: '700',
  },
});
