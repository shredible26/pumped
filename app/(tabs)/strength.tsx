import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, spacing, radius } from '@/utils/theme';

export default function StrengthScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Strength</Text>

        {/* Total Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>TOTAL STRENGTH SCORE</Text>
          <Text style={styles.scoreNumber}>—</Text>
          <Text style={styles.scoreSubtext}>
            Log a squat, bench press, or deadlift to start tracking your
            strength.
          </Text>
        </View>

        {/* Lift Cards */}
        {(['Squat', 'Bench Press', 'Deadlift'] as const).map((lift) => (
          <View key={lift} style={styles.liftCard}>
            <Text style={styles.liftName}>{lift}</Text>
            <Text style={styles.liftE1rm}>— lbs</Text>
            <Text style={styles.liftBasis}>No data yet</Text>
          </View>
        ))}

        {/* Chart Placeholder */}
        <View style={styles.chartCard}>
          <Text style={styles.chartLabel}>PROGRESS</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>
              Chart will appear after logging Big 3 lifts
            </Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: font.xxxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  scoreCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1,
  },
  scoreNumber: {
    fontSize: font.display,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  scoreSubtext: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  liftCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  liftName: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  liftE1rm: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  liftBasis: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  chartCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chartLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1,
  },
  chartPlaceholder: {
    height: 180,
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPlaceholderText: {
    color: colors.text.tertiary,
    fontSize: font.sm,
  },
});
