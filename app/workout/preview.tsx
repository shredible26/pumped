import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { useWorkoutStore, ActiveExercise } from '@/stores/workoutStore';
import { supabase } from '@/services/supabase';
import { createSession } from '@/services/workouts';
import { AIWorkoutPlan, AIExercisePlan } from '@/types/workout';

export default function WorkoutPreviewScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const startSession = useWorkoutStore((s) => s.startSession);

  const [plan, setPlan] = useState<AIWorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [whyExercise, setWhyExercise] = useState<AIExercisePlan | null>(null);

  useEffect(() => {
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
    if (!session?.user?.id) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('ai_workout_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('plan_date', today)
      .eq('used', false)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPlan(data as AIWorkoutPlan | null);
    setLoading(false);
  };

  const programColor = profile?.program_style
    ? colors.program[profile.program_style] ?? colors.accent.primary
    : colors.accent.primary;

  const handleStart = async () => {
    if (!session?.user?.id || !plan) return;
    setStarting(true);
    try {
      const exercises = (plan.exercises ?? []) as AIExercisePlan[];
      const ws = await createSession({
        user_id: session.user.id,
        date: new Date().toISOString().split('T')[0],
        name: plan.workout_name,
        workout_type: plan.workout_type,
        source: 'ai_generated',
        exercise_count: exercises.length,
        set_count: exercises.reduce((sum, e) => sum + e.sets, 0),
        total_volume: 0,
        pr_count: 0,
        completed: false,
        started_at: new Date().toISOString(),
      });

      const activeExercises: ActiveExercise[] = exercises.map((e) => ({
        exercise_id: e.exercise_id,
        name: e.name,
        primary_muscle: '',
        equipment: '',
        is_compound: e.rest_seconds >= 120,
        sets: e.sets,
        target_reps: e.target_reps,
        target_weight: e.target_weight,
        rest_seconds: e.rest_seconds,
        why: e.why,
      }));

      startSession(ws.id, plan.workout_name, 'ai_generated', activeExercises);
      router.replace('/workout/active');
    } catch (err) {
      console.warn('Failed to start workout:', err);
    } finally {
      setStarting(false);
    }
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
            No AI workout available for today. Try logging a custom workout instead.
          </Text>
          <Pressable
            style={styles.customButton}
            onPress={() => router.replace('/workout/custom')}
          >
            <Text style={styles.customButtonText}>Log Custom Workout</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const exercises = (plan.exercises ?? []) as AIExercisePlan[];
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const estMinutes = Math.round(exercises.length * 8);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Today's Workout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.workoutName}>{plan.workout_name}</Text>

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
                  {ex.sets} sets · {ex.target_reps} reps · {ex.target_weight} lbs
                </Text>
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
        <Pressable
          style={[styles.startButton, starting && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.startButtonText}>Start Workout</Text>
          )}
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
                <View style={styles.whyTag}>
                  <Text style={styles.whyTagText}>
                    {whyExercise?.target_reps} reps
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
