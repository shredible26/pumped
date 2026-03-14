import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useAuthStore } from '@/stores/authStore';
import { completeSession, insertSetLogs } from '@/services/workouts';
import { applyWorkoutFatigue, recordWorkoutStrain } from '@/services/fatigue';
import { recalculateProfileMetrics } from '@/services/profileMetrics';
import { fetchExercises } from '@/services/exercises';
import type { SavedWorkoutExercise, SavedWorkoutSetDetail } from '@/services/savedWorkouts';
import { supabase } from '@/services/supabase';
import { e1rm } from '@/utils/epley';
import { clearActiveWorkout } from '@/utils/storage';
import { isDurationExercise } from '@/utils/exerciseUtils';
import type { ActiveExercise, CompletedSet } from '@/stores/workoutStore';

interface SummaryData {
  duration: number;
  totalVolume: number;
  exerciseCount: number;
  setCount: number;
  prCount: number;
  prs: { exerciseName: string; e1rm: number }[];
  newStrengthScore: number | null;
  prevStrengthScore: number | null;
  streak: number;
}

interface SavedWorkoutPayload {
  name: string;
  workoutType: string | null;
  exercises: SavedWorkoutExercise[];
}

function buildSavedWorkoutExercises(
  setLogs:
    | Array<{
        exercise_name?: string | null;
        exercise_order?: number | null;
        set_number?: number | null;
        actual_weight?: number | null;
        actual_reps?: number | null;
        actual_seconds?: number | null;
      }>
    | null
    | undefined,
  fallbackName: string,
  fallbackSetCount = 1
): SavedWorkoutPayload['exercises'] {
  if (!setLogs || setLogs.length === 0) {
    return [
      {
        name: fallbackName,
        sets: Math.max(1, fallbackSetCount),
        set_details: Array.from({ length: Math.max(1, fallbackSetCount) }, (_, index) => ({
          set_number: index + 1,
        })),
      },
    ];
  }

  const grouped = new Map<number, { name: string; set_details: SavedWorkoutSetDetail[] }>();

  for (const log of setLogs) {
    const order = Number(log.exercise_order ?? 0);
    const existing = grouped.get(order) ?? {
      name: log.exercise_name ?? fallbackName,
      set_details: [],
    };

    existing.set_details.push({
      set_number: Number(log.set_number ?? existing.set_details.length + 1),
      ...(log.actual_weight != null ? { weight: Number(log.actual_weight) } : {}),
      ...(log.actual_reps != null ? { reps: Number(log.actual_reps) } : {}),
      ...(log.actual_seconds != null ? { seconds: Number(log.actual_seconds) } : {}),
    });
    grouped.set(order, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => ({
      name: value.name,
      sets: value.set_details.length,
      set_details: value.set_details.sort((a, b) => a.set_number - b.set_number),
    }));
}

function buildSavedWorkoutExercisesFromCompletedSets(
  activeExercises: ActiveExercise[],
  loggedSets: CompletedSet[],
): SavedWorkoutPayload['exercises'] {
  const grouped = new Map<number, SavedWorkoutExercise>();

  for (const completedSet of loggedSets) {
    const exercise = activeExercises[completedSet.exerciseIndex];
    if (!exercise) continue;

    const existing = grouped.get(completedSet.exerciseIndex) ?? {
      name: exercise.name,
      sets: exercise.sets,
      set_details: [],
    };

    const durationBased = isDurationExercise(exercise);
    existing.set_details.push({
      set_number: completedSet.setIndex + 1,
      ...(completedSet.weight > 0 ? { weight: completedSet.weight } : {}),
      ...(durationBased
        ? completedSet.seconds != null
          ? { seconds: completedSet.seconds }
          : {}
        : { reps: completedSet.reps }),
    });
    existing.sets = Math.max(existing.sets, existing.set_details.length);
    grouped.set(completedSet.exerciseIndex, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([, exercise]) => ({
      ...exercise,
      set_details: exercise.set_details.sort((a, b) => a.set_number - b.set_number),
    }));
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const urlSessionId = params.sessionId;

  const {
    sessionId: storeSessionId,
    workoutName,
    exercises,
    completedSets,
    startedAt,
    reset,
  } = useWorkoutStore();

  const sessionId = urlSessionId ?? storeSessionId;
  const fromLogFlow = !!urlSessionId;

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [saving, setSaving] = useState(true);
  const [displayName, setDisplayName] = useState(workoutName);
  const [savePayload, setSavePayload] = useState<SavedWorkoutPayload | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const processedSessionRef = useRef<string | null>(null);

  const hydrateSaveState = useCallback(async (payload: SavedWorkoutPayload | null) => {
    setSavePayload(payload);
    setSaveState('idle');
  }, []);

  const loadSummaryFromSession = useCallback(async (sid: string) => {
    if (!session?.user?.id) {
      setSaving(false);
      return;
    }
    try {
      const { data: sessionData } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sid)
        .single();
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      const { data: setLogs } = await supabase
        .from('set_logs')
        .select('exercise_name, exercise_order, set_number, actual_weight, actual_reps, actual_seconds')
        .eq('session_id', sid)
        .order('exercise_order')
        .order('set_number');

      if (sessionData && !sessionData.is_cardio && Number(sessionData.set_count ?? 0) > 0) {
        try {
          await recordWorkoutStrain(
            session.user.id,
            sid,
            sessionData.completed_at
              ? new Date(sessionData.completed_at)
              : new Date(`${sessionData.date}T12:00:00`),
          );
        } catch (strainError) {
          console.warn('Load summary strain sync error:', strainError);
        }
      }

      if (sessionData) setDisplayName(sessionData.name);
      if (profileData) setProfile(profileData as any);

      const durationMin = sessionData?.duration_seconds
        ? Math.round(sessionData.duration_seconds / 60)
        : 0;
      const totalVolume = Number(sessionData?.total_volume ?? 0);
      const exerciseCount = sessionData?.exercise_count ?? 0;
      const setCount = sessionData?.set_count ?? 0;
      const prCount = sessionData?.pr_count ?? 0;
      const streak = profileData?.current_streak_days ?? 0;
      const newScore = profileData?.strength_score ?? 0;

      setSummary({
        duration: durationMin,
        totalVolume,
        exerciseCount,
        setCount,
        prCount,
        prs: [],
        newStrengthScore: newScore > 0 ? newScore : null,
        prevStrengthScore: null,
        streak,
      });

      await hydrateSaveState(
        sessionData
          ? {
              name: sessionData.name,
              workoutType: sessionData.workout_type ?? null,
              exercises: buildSavedWorkoutExercises(
                setLogs as any[] | null | undefined,
                sessionData.name,
                sessionData.set_count ?? 1
              ),
            }
          : null
      );
    } catch (err) {
      console.warn('Load summary error:', err);
    } finally {
      setSaving(false);
    }
  }, [session?.user?.id, setProfile, hydrateSaveState]);

  const finalizeWorkout = useCallback(async () => {
    if (!session?.user?.id || !sessionId) {
      setSaving(false);
      return;
    }

    try {
      const userId = session.user.id;
      const endTime = Date.now();
      const startTime = startedAt ? new Date(startedAt).getTime() : endTime;
      const durationSec = Math.round((endTime - startTime) / 1000);
      const durationMin = Math.round(durationSec / 60);

      let totalVolume = 0;
      const setLogs: any[] = [];
      const volByExIndex = new Map<number, number>();

      for (const cs of completedSets) {
        const ex = exercises[cs.exerciseIndex];
        if (!ex) continue;
        const durationBased = isDurationExercise(ex);

        const vol = durationBased ? 0 : cs.weight * cs.reps;
        totalVolume += vol;
        volByExIndex.set(cs.exerciseIndex, (volByExIndex.get(cs.exerciseIndex) ?? 0) + vol);

        setLogs.push({
          session_id: sessionId,
          exercise_id: ex.exercise_id,
          exercise_name: ex.name,
          exercise_order: cs.exerciseIndex,
          set_number: cs.setIndex + 1,
          target_weight: ex.target_weight || null,
          target_reps: durationBased ? null : parseInt(ex.target_reps.split('-')[0], 10) || null,
          actual_weight: cs.weight > 0 ? cs.weight : null,
          actual_reps: durationBased ? null : cs.reps,
          actual_seconds: durationBased ? cs.seconds ?? undefined : undefined,
          is_warmup: false,
          is_pr: false,
          completed: true,
        });
      }

      // Calculate PRs for Big Three
      const prs: { exerciseName: string; e1rm: number }[] = [];
      let newSquat = profile?.squat_e1rm ?? 0;
      let newBench = profile?.bench_e1rm ?? 0;
      let newDeadlift = profile?.deadlift_e1rm ?? 0;

      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const setsForEx = completedSets.filter((s) => s.exerciseIndex === i);

        for (const s of setsForEx) {
          if (s.weight <= 0 || s.reps <= 0) continue;
          const estimated = e1rm(s.weight, s.reps);
          const name = ex.name.toLowerCase();

          if (name.includes('squat') && estimated > newSquat) {
            newSquat = estimated;
            prs.push({ exerciseName: ex.name, e1rm: estimated });
          } else if (
            (name.includes('bench') || name.includes('bench press')) &&
            estimated > newBench
          ) {
            newBench = estimated;
            prs.push({ exerciseName: ex.name, e1rm: estimated });
          } else if (name.includes('deadlift') && estimated > newDeadlift) {
            newDeadlift = estimated;
            prs.push({ exerciseName: ex.name, e1rm: estimated });
          }
        }
      }

      // Mark PRs in set logs
      for (const pr of prs) {
        const log = setLogs.find((l) => l.exercise_name === pr.exerciseName);
        if (log) log.is_pr = true;
      }

      // Save set logs
      if (setLogs.length > 0) {
        await insertSetLogs(setLogs).catch((e) =>
          console.warn('Failed to insert set logs:', e),
        );
      }

      // Complete session
      await completeSession(sessionId, {
        duration_seconds: durationSec,
        total_volume: totalVolume,
        exercise_count: exercises.length,
        set_count: completedSets.length,
        pr_count: prs.length,
      }).catch((e) => console.warn('Failed to complete session:', e));

      // Update muscle fatigue (primary + 50% secondary volume)
      try {
        const exList = await fetchExercises();
        const byId = new Map(exList.map((e) => [e.id, e]));
        const contributions: { primary_muscle: string | null; secondary_muscles?: string[]; volume: number }[] = [];
        for (let i = 0; i < exercises.length; i++) {
          const vol = volByExIndex.get(i) ?? 0;
          if (vol <= 0) continue;
          const ex = exercises[i];
          const full = byId.get(ex.exercise_id);
          contributions.push({
            primary_muscle: ex.primary_muscle || full?.primary_muscle || null,
            secondary_muscles: full?.secondary_muscles,
            volume: vol,
          });
        }
        await applyWorkoutFatigue(userId, contributions);
        await recordWorkoutStrain(userId, sessionId, new Date());
      } catch (e) {
        console.warn('Failed to update fatigue:', e);
      }

      const prevScore = profile?.strength_score ?? 0;
      const updatedProfile = await recalculateProfileMetrics(userId, {
        preserveExistingBigThree: true,
      });
      if (updatedProfile) setProfile(updatedProfile as any);
      const newScore = Number(updatedProfile?.strength_score ?? 0);

      // Strength history record
      if (updatedProfile && newScore > 0) {
        try {
          await supabase.from('strength_history').insert({
            user_id: userId,
            squat_e1rm: Number(updatedProfile.squat_e1rm) || null,
            bench_e1rm: Number(updatedProfile.bench_e1rm) || null,
            deadlift_e1rm: Number(updatedProfile.deadlift_e1rm) || null,
            total_score: newScore,
          });
        } catch {}
      }

      clearActiveWorkout();

      const summaryData: SummaryData = {
        duration: durationMin,
        totalVolume,
        exerciseCount: exercises.length,
        setCount: completedSets.length,
        prCount: prs.length,
        prs,
        newStrengthScore: newScore > 0 ? newScore : null,
        prevStrengthScore: prevScore > 0 ? prevScore : null,
        streak: Number(updatedProfile?.current_streak_days ?? 0),
      };

      setSummary(summaryData);
      await hydrateSaveState({
        name: workoutName || 'Workout',
        workoutType: null,
        exercises: buildSavedWorkoutExercisesFromCompletedSets(exercises, completedSets),
      });

      if (prs.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Finalize error:', err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, exercises, completedSets, startedAt, session?.user?.id, profile, workoutName, hydrateSaveState]);

  useEffect(() => {
    if (!sessionId) {
      setSaving(false);
      return;
    }

    if (processedSessionRef.current === sessionId) return;
    processedSessionRef.current = sessionId;

    if (fromLogFlow && urlSessionId) {
      void loadSummaryFromSession(urlSessionId);
    } else {
      void finalizeWorkout();
    }
  }, [sessionId, fromLogFlow, urlSessionId, loadSummaryFromSession, finalizeWorkout]);

  const handleGoHome = () => {
    reset();
    router.dismissTo('/(tabs)');
  };

  const handleSaveWorkout = useCallback(async () => {
    if (!session?.user?.id || !savePayload || saveState === 'saved' || saveState === 'saving') return;

    setSaveState('saving');
    try {
      const { error } = await supabase.from('saved_workouts').insert({
        user_id: session.user.id,
        name: savePayload.name,
        workout_type: savePayload.workoutType as any,
        exercises: savePayload.exercises,
        last_used_at: new Date().toISOString(),
        use_count: 1,
      });

      if (error) throw error;
      setSaveState('saved');
    } catch (err: any) {
      setSaveState('idle');
      Alert.alert('Error', err?.message ?? 'Failed to save workout');
    }
  }, [session?.user?.id, savePayload, saveState]);

  if (saving) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.savingText}>
            {fromLogFlow ? 'Loading summary...' : 'Saving workout...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.emoji}>💪</Text>
        <Text style={styles.title}>Workout Complete!</Text>
        <Text style={styles.subtitle}>{displayName || workoutName || 'Great session'}</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary?.duration ?? 0} min</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {(summary?.totalVolume ?? 0).toLocaleString()} lbs
            </Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary?.exerciseCount ?? 0}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{summary?.setCount ?? 0}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
        </View>

        {/* PR Cards */}
        {summary && summary.prs.length > 0 && (
          <View style={styles.prCard}>
            <Text style={styles.prEmoji}>🏆</Text>
            <Text style={styles.prTitle}>New Personal Record!</Text>
            {summary.prs.map((pr, i) => (
              <Text key={i} style={styles.prDetail}>
                {pr.exerciseName}: {pr.e1rm} lbs e1RM
              </Text>
            ))}
          </View>
        )}

        {/* Strength Score */}
        {summary?.newStrengthScore && (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>STRENGTH SCORE</Text>
            <View style={styles.scoreRow}>
              {summary.prevStrengthScore ? (
                <>
                  <Text style={styles.scorePrev}>{summary.prevStrengthScore}</Text>
                  <Text style={styles.scoreArrow}>→</Text>
                </>
              ) : null}
              <Text style={styles.scoreNew}>{summary.newStrengthScore}</Text>
            </View>
          </View>
        )}

        {/* Streak */}
        {summary && summary.streak > 0 && (
          <View style={styles.streakCard}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>
              {summary.streak === 1
                ? 'Streak started!'
                : `${summary.streak} Day Streak!`}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {savePayload ? (
          <Pressable
            style={[
              styles.saveWorkoutButton,
              saveState === 'saved' && styles.saveWorkoutButtonSaved,
            ]}
            onPress={handleSaveWorkout}
            disabled={saveState === 'saving' || saveState === 'saved'}
          >
            {saveState === 'saving' ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Ionicons
                  name={saveState === 'saved' ? 'checkmark-circle' : 'bookmark-outline'}
                  size={18}
                  color={saveState === 'saved' ? colors.text.inverse : colors.text.primary}
                />
                <Text
                  style={[
                    styles.saveWorkoutButtonText,
                    saveState === 'saved' && styles.saveWorkoutButtonTextSaved,
                  ]}
                >
                  {saveState === 'saved' ? 'Saved to Workouts' : 'Save Workout'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
        <Pressable style={styles.homeButton} onPress={handleGoHome}>
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  savingText: {
    fontSize: font.lg,
    color: colors.text.secondary,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: 120,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: font.lg,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xxxl,
    width: '100%',
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statValue: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  prCard: {
    width: '100%',
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.25)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  prEmoji: {
    fontSize: 36,
  },
  prTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: '#FACC15',
    marginTop: spacing.sm,
  },
  prDetail: {
    fontSize: font.md,
    color: colors.text.primary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },

  scoreCard: {
    width: '100%',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  scoreLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  scorePrev: {
    fontSize: font.xxl,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  scoreArrow: {
    fontSize: font.xl,
    color: colors.text.tertiary,
  },
  scoreNew: {
    fontSize: font.display,
    fontWeight: '800',
    color: colors.accent.primary,
  },

  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accent.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    width: '100%',
    justifyContent: 'center',
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakText: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.accent.primary,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  saveWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  saveWorkoutButtonSaved: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  saveWorkoutButtonText: {
    color: colors.text.primary,
    fontSize: font.lg,
    fontWeight: '700',
  },
  saveWorkoutButtonTextSaved: {
    color: colors.text.inverse,
  },
  homeButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  homeButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
});
