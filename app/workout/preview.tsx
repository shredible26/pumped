import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { useWorkoutStore, ActiveExercise } from '@/stores/workoutStore';
import { getTodaysPlan } from '@/services/ai';
import { createSession } from '@/services/workouts';
import type { GeneratedWorkout, GeneratedExercise } from '@/services/ai';
import { getGenerationCreditsRemaining, DAILY_LIMIT } from '@/services/credits';
import { supabase } from '@/services/supabase';

export default function WorkoutPreviewScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const startSession = useWorkoutStore((s) => s.startSession);

  const [plan, setPlan] = useState<GeneratedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [whyExercise, setWhyExercise] = useState<GeneratedExercise | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!session?.user?.id) return;
    const p = await getTodaysPlan(session.user.id);
    setPlan(p);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const programColor = profile?.program_style
    ? colors.program[profile.program_style] ?? colors.accent.primary
    : colors.accent.primary;

  const handleLogWorkout = () => {
    router.push('/workout/log');
  };

  const handleSaveWorkout = async () => {
    if (!session?.user?.id || !plan) return;
    try {
      await supabase.from('saved_workouts').insert({
        user_id: session.user.id,
        name: plan.name || 'My Workout',
        workout_type: (plan.type ?? null) as any,
        exercises: (plan.exercises ?? []).map((ex) => ({
          name: ex.name,
          sets: ex.sets,
        })),
        last_used_at: new Date().toISOString(),
        use_count: 1,
      });
      Alert.alert('Saved', 'Workout added to your saved workouts.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save workout');
    }
  };

  const handleDone = () => {
    router.replace('/(tabs)');
  };

  const handleCustomize = async () => {
    const remaining = await getGenerationCreditsRemaining(profile ?? null);
    if (remaining <= 0) {
      Alert.alert(
        'No generations left',
        `You've used all ${DAILY_LIMIT} daily generations. Try again tomorrow, or use Speed Log.`,
      );
      return;
    }
    Alert.alert(
      'Customize Workout',
      `This will customize your workout and use 1 of your ${remaining} remaining daily credits. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => router.push('/workout/modifications'),
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color={colors.accent.primary}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Today's Workout</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyTitle}>No workout planned</Text>
          <Text style={styles.emptySubtext}>
            No AI workout available for today. Generate one from the home screen or log a custom workout.
          </Text>
          <Pressable
            style={styles.customButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.customButtonText}>Back to Today</Text>
          </Pressable>
          <Pressable
            style={[styles.customButton, { marginTop: spacing.sm, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border.light }]}
            onPress={() => router.replace('/workout/custom')}
          >
            <Text style={[styles.customButtonText, { color: colors.text.primary }]}>Log Custom Workout</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const exercises = plan.exercises ?? [];
  const estMinutes = plan.estimated_minutes ?? Math.round(exercises.length * 8);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Today's Workout</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleDone}
            hitSlop={8}
            style={styles.headerActionButton}
          >
            <Text style={styles.headerActionText}>Done</Text>
          </Pressable>
          <Pressable
            onPress={handleSaveWorkout}
            hitSlop={8}
            style={[styles.headerActionButton, styles.headerSaveButton]}
          >
            <Text style={[styles.headerActionText, styles.headerSaveText]}>Save</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.workoutName}>{plan.name}</Text>

        {plan.description ? (
          <Text style={styles.workoutDescription}>
            {plan.description}
          </Text>
        ) : null}

        {(plan.primary_targets && plan.primary_targets.length > 0) ? (
          <View style={styles.targetsRow}>
            {plan.primary_targets.map((t) => (
              <View key={t} style={[styles.targetPill, { borderColor: programColor + '66' }]}>
                <Text style={[styles.targetPillText, { color: programColor }]}>
                  {String(t).replace('_', ' ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <Ionicons name="barbell-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.tagText}>{exercises.length} exercises</Text>
          </View>
          <View style={styles.tag}>
            <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.tagText}>~{estMinutes} min</Text>
          </View>
          {profile?.program_style && (
            <View style={[styles.tag, { borderColor: programColor + '40' }]}>
              <Text style={[styles.tagText, { color: programColor }]}>
                {profile.program_style.replace('_', '/').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {exercises.map((ex, i) => (
          <View key={`${ex.exercise_id}-${i}`} style={styles.exerciseCard}>
            <View style={styles.exerciseRow}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>{i + 1}</Text>
              </View>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Text style={styles.exerciseStats}>
                  {ex.sets} sets
                  {ex.target_seconds != null
                    ? ` · ${ex.target_seconds}s`
                    : ` · ${ex.target_reps} reps`}
                  {(ex.target_weight_lbs ?? 0) > 0 ? ` · ${ex.target_weight_lbs} lbs` : ''}
                </Text>
                {ex.primary_muscle ? (
                  <Text style={styles.exerciseMeta}>
                    {ex.primary_muscle.replace('_', ' ')}
                  </Text>
                ) : null}
              </View>
              {ex.why ? (
                <Pressable
                  style={styles.whyButton}
                  onPress={() => setWhyExercise(ex)}
                >
                  <Text style={styles.whyText}>Why?</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.startButton} onPress={handleLogWorkout}>
          <Text style={styles.startButtonText}>Log This Workout</Text>
        </Pressable>
        <Pressable style={styles.customizeButton} onPress={() => void handleCustomize()}>
          <Ionicons name="create-outline" size={20} color={colors.text.primary} />
          <Text style={styles.customizeButtonText}>Regenerate</Text>
        </Pressable>
      </View>

      {/* Why? Sheet */}
      <Modal
        visible={!!whyExercise}
        transparent
        animationType="slide"
        onRequestClose={() => setWhyExercise(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setWhyExercise(null)}>
          <View style={styles.sheet}>
            <Pressable>
              <View style={styles.handleBar} />
              <Text style={styles.whySheetLabel}>WHY THIS EXERCISE?</Text>
              <Text style={styles.whySheetName}>{whyExercise?.name}</Text>
              <Text style={styles.whySheetBody}>
                {whyExercise?.why || 'No explanation available for this exercise.'}
              </Text>
              <View style={styles.whyTagsRow}>
                {whyExercise?.primary_muscle && (
                  <View style={styles.whyTag}>
                    <Text style={styles.whyTagText}>
                      {whyExercise.primary_muscle.replace('_', ' ')}
                    </Text>
                  </View>
                )}
                <View style={styles.whyTag}>
                  <Text style={styles.whyTagText}>
                    {whyExercise?.sets} sets × {whyExercise?.target_reps} reps
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.gotItButton}
                onPress={() => setWhyExercise(null)}
              >
                <Text style={styles.gotItText}>Got it</Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  headerActionText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  headerSaveButton: {
    backgroundColor: colors.accent.bg,
    borderColor: colors.accent.border,
  },
  headerSaveText: {
    color: colors.accent.primary,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  workoutName: {
    fontSize: font.xxxl,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  workoutDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  targetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  targetPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.bg.input,
  },
  targetPillText: {
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  tagText: {
    fontSize: font.sm,
    color: colors.text.secondary,
  },
  exerciseCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    color: colors.accent.primary,
    fontWeight: '700',
    fontSize: font.sm,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  exerciseStats: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  exerciseMeta: {
    fontSize: font.xs,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  whyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accent.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  whyText: {
    color: colors.accent.primary,
    fontSize: font.sm,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
  },
  startButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  customizeButtonText: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: font.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  customButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  customButtonText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: font.md,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing.md,
    minHeight: 280,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.tertiary,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  whySheetLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.accent.primary,
    letterSpacing: 1,
  },
  whySheetName: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  whySheetBody: {
    fontSize: font.md,
    color: colors.text.secondary,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  whyTagsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  whyTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.input,
  },
  whyTagText: {
    fontSize: font.sm,
    color: colors.text.secondary,
  },
  gotItButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  gotItText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: font.md,
  },
});
