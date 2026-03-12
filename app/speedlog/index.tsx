import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { getWorkoutTypeForDate } from '@/utils/schedule';

const PPL_TYPES = ['Push', 'Pull', 'Legs'];
const UL_TYPES = ['Upper', 'Lower'];

function getSplitTypes(style: string | undefined): string[] {
  switch (style) {
    case 'ppl':
      return PPL_TYPES;
    case 'upper_lower':
      return UL_TYPES;
    case 'aesthetic':
    case 'ai_optimal':
      return ['AI Optimal'];
    default:
      return PPL_TYPES;
  }
}

/** Scheduled type for a given date; display "Cardio" on rest days, "AI Optimal" for AI Workout. */
function getRecommendedDisplayType(
  style: string | undefined,
  date: Date,
  trainingFreq: number
): string {
  const scheduled = getWorkoutTypeForDate(style, date, trainingFreq);
  if (scheduled === 'Rest') return 'Cardio';
  if (scheduled === 'AI Workout') return 'AI Optimal';
  return scheduled;
}

export default function SpeedLogTypeScreen() {
  const router = useRouter();
  const { logForDate } = useLocalSearchParams<{ logForDate?: string }>();
  const profile = useAuthStore((s) => s.profile);
  const programStyle = profile?.program_style;
  const trainingFreq = profile?.training_frequency ?? 4;
  const date = logForDate
    ? new Date(logForDate + 'T12:00:00')
    : new Date();
  const recommended = getRecommendedDisplayType(programStyle, date, trainingFreq);
  const allTypes = getSplitTypes(programStyle);
  const otherTypes = allTypes.filter((t) => t !== recommended);

  const selectType = (type: string) => {
    router.push({
      pathname: '/speedlog/editor',
      params: { type, ...(logForDate ? { date: logForDate } : {}) },
    });
  };

  const handleLogCardio = () => {
    router.push({
      pathname: '/cardio/log',
      ...(logForDate ? { params: { logForDate } } : {}),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Speed Log</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.subtitle}>What did you work on?</Text>

        {/* YOUR SPLIT: scheduled first, then other split options */}
        <Text style={styles.sectionLabel}>YOUR SPLIT</Text>
        <Pressable
          style={styles.recommendedCard}
          onPress={() => selectType(recommended)}
        >
          <View style={styles.recommendedLeft}>
            <Ionicons name="calendar" size={20} color={colors.accent.primary} />
            <Text style={styles.recommendedText}>{recommended}</Text>
          </View>
          <View style={styles.bestMatchBadge}>
            <Text style={styles.bestMatchText}>SCHEDULED</Text>
          </View>
        </Pressable>

        {otherTypes.length > 0 &&
          otherTypes.map((type) => (
            <Pressable
              key={type}
              style={styles.typeCard}
              onPress={() => selectType(type)}
            >
              <Ionicons
                name="barbell-outline"
                size={18}
                color={colors.text.secondary}
              />
              <Text style={styles.typeText}>{type}</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.text.tertiary}
              />
            </Pressable>
          ))}

        <Text style={styles.orLabel}>OR</Text>

        {/* Log Cardio */}
        <Text style={styles.sectionLabel}>LOG CARDIO</Text>
        <Pressable style={styles.cardioCard} onPress={handleLogCardio}>
          <Ionicons name="bicycle" size={20} color={colors.accent.primary} />
          <Text style={styles.cardioCardText}>Log Cardio</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </Pressable>

        <Text style={styles.orLabel}>OR</Text>

        {/* Build your own */}
        <Text style={styles.sectionLabel}>LOG CUSTOM WORKOUT</Text>
        <Pressable
          style={styles.scratchCard}
          onPress={() => selectType('Custom')}
        >
          <View style={styles.scratchIcon}>
            <Ionicons name="add" size={24} color={colors.accent.primary} />
          </View>
          <View>
            <Text style={styles.scratchTitle}>Build Your Own</Text>
            <Text style={styles.scratchSubtext}>
              Pick exercises, sets & reps from scratch
            </Text>
          </View>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: font.sm,
    color: colors.text.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  subtitle: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  recommendedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    marginBottom: spacing.sm,
  },
  recommendedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recommendedText: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  bestMatchBadge: {
    backgroundColor: colors.accent.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  bestMatchText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent.primary,
    letterSpacing: 0.5,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  typeText: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  orLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.tertiary,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  cardioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  cardioCardText: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scratchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  scratchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scratchTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scratchSubtext: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
