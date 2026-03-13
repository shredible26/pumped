import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { MinuteSecondInput } from '@/components/ui/MinuteSecondInput';
import { useWorkoutStore } from '@/stores/workoutStore';
import {
  durationPartsToSeconds,
  formatDurationLabel,
  isDurationExercise,
  secondsToDurationParts,
  showWeightInput,
} from '@/utils/exerciseUtils';

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const {
    exercises,
    currentExIndex,
    currentSetIndex,
    completedSets,
    isResting,
    restSeconds,
    logSet,
    advanceAfterRest,
    skipRest,
    setResting,
    isSetCompleted,
    getCompletedSet,
    getAllExerciseComplete,
    reset,
    sessionId,
    startedAt,
  } = useWorkoutStore();

  const exercise = exercises[currentExIndex];
  const totalExercises = exercises.length;

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [restCountdown, setRestCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (exercise) {
      const allowWeight = showWeightInput(exercise);
      const durationBased = isDurationExercise(exercise);
      const defaultDuration = secondsToDurationParts(exercise.target_seconds);
      setWeight(allowWeight ? (exercise.target_weight > 0 ? String(exercise.target_weight) : '') : '0');
      setReps(durationBased ? '0' : (exercise.target_reps.split('-')[0] || '8'));
      setDurationMinutes(durationBased ? defaultDuration.minutes : '');
      setDurationSeconds(durationBased ? defaultDuration.seconds : '');
    }
  }, [currentExIndex, exercise]);

  useEffect(() => {
    if (isResting && restSeconds > 0) {
      setRestCountdown(restSeconds);
      timerRef.current = setInterval(() => {
        setRestCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            advanceAfterRest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isResting, restSeconds]);

  const handleCompleteSet = useCallback(() => {
    const durationBased = exercise && isDurationExercise(exercise);
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps, 10) || 0;
    const sec = durationBased
      ? durationPartsToSeconds(durationMinutes, durationSeconds) ?? undefined
      : undefined;
    if (!durationBased && r <= 0) {
      Alert.alert('Enter reps', 'Please enter the number of reps completed.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logSet(w, durationBased ? 0 : r, sec);
  }, [weight, reps, durationMinutes, durationSeconds, exercise, logSet]);

  const handleSkipRest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRestCountdown(0);
    skipRest();
  }, [skipRest]);

  const handleFinish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace('/workout/summary');
  }, [router]);

  const handleEnd = useCallback(() => {
    Alert.alert('End Workout?', 'Your progress will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: () => {
          if (timerRef.current) clearInterval(timerRef.current);
          if (completedSets.length > 0) {
            router.replace('/workout/summary');
          } else {
            reset();
            router.dismissTo('/(tabs)');
          }
        },
      },
    ]);
  }, [completedSets, reset, router]);

  const allDone = getAllExerciseComplete();
  const durationBased = isDurationExercise(exercise);
  const allowWeight = showWeightInput(exercise);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const completedForExercise = (exIndex: number) =>
    completedSets.filter((s) => s.exerciseIndex === exIndex).length;

  if (!exercise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No workout loaded</Text>
          <Pressable style={styles.backBtn} onPress={() => router.dismissTo('/(tabs)')}>
            <Text style={styles.backBtnText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.counter}>
            {currentExIndex + 1}/{totalExercises}
          </Text>
          <Pressable onPress={handleEnd}>
            <Text style={styles.endText}>End</Text>
          </Pressable>
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {exercises.map((_, i) => {
            const done = completedForExercise(i) >= exercises[i].sets;
            const current = i === currentExIndex;
            return (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  done && styles.progressDotDone,
                  current && !done && styles.progressDotCurrent,
                ]}
              />
            );
          })}
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Exercise info */}
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseMeta}>
            {exercise.primary_muscle}
            {exercise.equipment ? ` · ${exercise.equipment}` : ''}
          </Text>

          {/* Rest Timer */}
          {isResting && (
            <View style={styles.restContainer}>
              <Text style={styles.restLabel}>REST</Text>
              <Text style={styles.restTimer}>{formatTime(restCountdown)}</Text>
              <Pressable style={styles.skipRestBtn} onPress={handleSkipRest}>
                <Text style={styles.skipRestText}>Skip Rest</Text>
              </Pressable>
            </View>
          )}

          {/* Set Rows */}
          <View style={styles.setHeader}>
            <Text style={[styles.setHeaderText, { flex: 0.5 }]}>SET</Text>
            {allowWeight && <Text style={[styles.setHeaderText, { flex: 1 }]}>WEIGHT</Text>}
            <Text style={[styles.setHeaderText, { flex: durationBased ? 1.5 : 1 }]}>
              {durationBased ? 'DURATION' : 'REPS'}
            </Text>
            <Text style={[styles.setHeaderText, { flex: 0.5 }]} />
          </View>

          {Array.from({ length: exercise.sets }, (_, setIdx) => {
            const completed = isSetCompleted(currentExIndex, setIdx);
            const setData = getCompletedSet(currentExIndex, setIdx);
            const isCurrent = setIdx === currentSetIndex && !isResting;

            return (
              <View
                key={setIdx}
                style={[
                  styles.setRow,
                  completed && styles.setRowCompleted,
                  isCurrent && styles.setRowCurrent,
                ]}
              >
                <View style={[styles.setCircle, completed && styles.setCircleCompleted]}>
                  {completed ? (
                    <Ionicons name="checkmark" size={14} color={colors.text.inverse} />
                  ) : (
                    <Text style={styles.setNumber}>{setIdx + 1}</Text>
                  )}
                </View>

                {completed ? (
                  <>
                    {allowWeight && (
                      <View style={[styles.setField, { flex: 1 }]}>
                        <Text style={styles.completedFieldText}>
                          {setData?.weight ?? 0} lbs
                        </Text>
                      </View>
                    )}
                    <View style={[styles.setField, { flex: durationBased ? 1.5 : 1 }]}>
                      <Text style={styles.completedFieldText}>
                        {setData?.seconds != null
                          ? formatDurationLabel(setData.seconds)
                          : `${setData?.reps ?? 0} reps`}
                      </Text>
                    </View>
                  </>
                ) : isCurrent ? (
                  <>
                    {allowWeight && (
                      <TextInput
                        style={[styles.setInput, { flex: 1 }]}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="numeric"
                        placeholder="lbs"
                        placeholderTextColor={colors.text.tertiary}
                        selectTextOnFocus
                      />
                    )}
                    {durationBased ? (
                      <View style={[styles.durationSetInputWrap, { flex: 1.5 }]}>
                        <MinuteSecondInput
                          minutes={durationMinutes}
                          seconds={durationSeconds}
                          onMinutesChange={setDurationMinutes}
                          onSecondsChange={setDurationSeconds}
                        />
                      </View>
                    ) : (
                      <TextInput
                        style={[styles.setInput, { flex: 1 }]}
                        value={reps}
                        onChangeText={setReps}
                        keyboardType="numeric"
                        placeholder="reps"
                        placeholderTextColor={colors.text.tertiary}
                        selectTextOnFocus
                      />
                    )}
                  </>
                ) : (
                  <>
                    {allowWeight && (
                      <View style={[styles.setField, { flex: 1 }]}>
                        <Text style={styles.pendingFieldText}>
                          {exercise.target_weight > 0
                            ? `${exercise.target_weight} lbs`
                            : '— lbs'}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.setField, { flex: durationBased ? 1.5 : 1 }]}>
                      <Text style={styles.pendingFieldText}>
                        {durationBased
                          ? exercise.target_seconds
                            ? formatDurationLabel(exercise.target_seconds)
                            : 'Optional'
                          : `${exercise.target_reps} reps`}
                      </Text>
                    </View>
                  </>
                )}

                <View style={{ flex: 0.5, alignItems: 'center' }}>
                  {completed && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent.primary} />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.footer}>
          {allDone ? (
            <Pressable style={styles.finishButton} onPress={handleFinish}>
              <Text style={styles.finishButtonText}>Finish Workout</Text>
            </Pressable>
          ) : !isResting ? (
            <Pressable style={styles.completeButton} onPress={handleCompleteSet}>
              <Text style={styles.completeButtonText}>Complete Set</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: font.lg,
    color: colors.text.secondary,
  },
  backBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  backBtnText: {
    color: colors.text.inverse,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  counter: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  endText: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.error,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.input,
  },
  progressDotDone: {
    backgroundColor: colors.accent.primary,
  },
  progressDotCurrent: {
    backgroundColor: colors.accent.dim,
    width: 20,
    borderRadius: 4,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  exerciseName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  exerciseMeta: {
    fontSize: font.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  restContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  restLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.accent.primary,
    letterSpacing: 2,
  },
  restTimer: {
    fontSize: font.display,
    fontWeight: '800',
    color: colors.accent.primary,
    marginTop: spacing.sm,
  },
  skipRestBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.input,
  },
  skipRestText: {
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: font.md,
  },

  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  setHeaderText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  setRowCompleted: {
    backgroundColor: 'rgba(74,222,128,0.06)',
  },
  setRowCurrent: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: radius.md,
  },
  setCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.5,
  },
  setCircleCompleted: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  setNumber: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  setInput: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  durationSetInputWrap: {
    paddingVertical: spacing.xs,
  },
  setField: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  completedFieldText: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.accent.primary,
  },
  pendingFieldText: {
    fontSize: font.md,
    color: colors.text.tertiary,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.sm,
  },
  completeButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  completeButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
  finishButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  finishButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
});
