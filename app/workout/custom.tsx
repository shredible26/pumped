import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { REST_DURATIONS } from '@/utils/constants';
import { useAuthStore } from '@/stores/authStore';
import { useWorkoutStore, ActiveExercise } from '@/stores/workoutStore';
import { fetchExercises } from '@/services/exercises';
import { createSession } from '@/services/workouts';
import { getLocalDateString } from '@/utils/date';
import { Exercise } from '@/types/exercise';
import { showSecondsInput } from '@/utils/exerciseUtils';

interface CustomExercise {
  exercise: Exercise;
  sets: number;
  targetReps: string;
}

export default function CustomWorkoutScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const startSession = useWorkoutStore((s) => s.startSession);

  const [name, setName] = useState('Custom Workout');
  const [exercises, setExercises] = useState<CustomExercise[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setLoadingExercises(true);
    try {
      const data = await fetchExercises();
      setAllExercises(data);
    } catch {
      console.warn('Failed to load exercises');
    } finally {
      setLoadingExercises(false);
    }
  };

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return allExercises;
    const q = searchQuery.toLowerCase();
    return allExercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.primary_muscle.toLowerCase().includes(q),
    );
  }, [searchQuery, allExercises]);

  const groupedExercises = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    for (const ex of filteredExercises) {
      const key = ex.primary_muscle;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ex);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredExercises]);

  const addExercise = (exercise: Exercise) => {
    const alreadyAdded = exercises.some(
      (e) => e.exercise.id === exercise.id,
    );
    if (alreadyAdded) return;
    setExercises((prev) => [
      ...prev,
      { exercise, sets: 3, targetReps: '8-12' },
    ]);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const adjustSets = (index: number, delta: number) => {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === index ? { ...e, sets: Math.max(1, Math.min(10, e.sets + delta)) } : e,
      ),
    );
  };

  const handleStart = async () => {
    if (!session?.user?.id || exercises.length === 0) return;
    setStarting(true);
    try {
      const ws = await createSession({
        user_id: session.user.id,
        date: getLocalDateString(),
        name,
        workout_type: null,
        source: 'custom',
        exercise_count: exercises.length,
        set_count: exercises.reduce((sum, e) => sum + e.sets, 0),
        total_volume: 0,
        pr_count: 0,
        completed: false,
        started_at: new Date().toISOString(),
      });

      const activeExercises: ActiveExercise[] = exercises.map((e) => {
        const isMainCompound = e.exercise.movement_pattern === 'squat' ||
          e.exercise.movement_pattern === 'hip_hinge' ||
          e.exercise.is_big_three;
        const isSecondary = e.exercise.movement_pattern.includes('push') ||
          e.exercise.movement_pattern.includes('pull') ||
          e.exercise.movement_pattern === 'lunge';
        const restSec = isMainCompound
          ? REST_DURATIONS.main_compound
          : isSecondary
            ? REST_DURATIONS.secondary_compound
            : REST_DURATIONS.isolation;

        const timeBased = showSecondsInput(e.exercise.equipment, e.exercise.name);
        return {
          exercise_id: e.exercise.id,
          name: e.exercise.name,
          primary_muscle: e.exercise.primary_muscle,
          equipment: e.exercise.equipment,
          is_compound: isMainCompound || isSecondary,
          sets: e.sets,
          target_reps: timeBased ? '0' : e.targetReps,
          target_weight: 0,
          ...(timeBased ? { target_seconds: 60 } : {}),
          rest_seconds: restSec,
        };
      });

      startSession(ws.id, name, 'custom', activeExercises);
      router.replace('/workout/active');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create workout');
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Custom Workout</Text>
        <View style={{ width: 24 }} />
      </View>

      <TextInput
        style={styles.nameInput}
        placeholder="Workout Name"
        placeholderTextColor={colors.text.tertiary}
        value={name}
        onChangeText={setName}
      />

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {exercises.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="add-circle-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No exercises added</Text>
            <Text style={styles.emptySubtext}>
              Tap the button below to search and add exercises
            </Text>
          </View>
        ) : (
          exercises.map((item, index) => (
            <View key={item.exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                  <Text style={styles.exerciseMuscle}>
                    {item.exercise.primary_muscle} · {item.exercise.equipment}
                  </Text>
                </View>
                <Pressable onPress={() => removeExercise(index)}>
                  <Ionicons name="close-circle" size={22} color={colors.text.tertiary} />
                </Pressable>
              </View>

              <View style={styles.setControls}>
                <Text style={styles.setLabel}>Sets</Text>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => adjustSets(index, -1)}
                  >
                    <Text style={styles.stepperText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{item.sets}</Text>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => adjustSets(index, 1)}
                  >
                    <Text style={styles.stepperText}>+</Text>
                  </Pressable>
                </View>

                <Text style={styles.setLabel}>Reps</Text>
                <TextInput
                  style={styles.repsInput}
                  value={item.targetReps}
                  onChangeText={(t) =>
                    setExercises((prev) =>
                      prev.map((e, i) => (i === index ? { ...e, targetReps: t } : e)),
                    )
                  }
                  keyboardType="default"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </View>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.addButton} onPress={() => setSearchOpen(true)}>
          <Text style={styles.addButtonText}>Add Exercise</Text>
        </Pressable>

        {exercises.length > 0 && (
          <Pressable
            style={[styles.startButton, starting && { opacity: 0.6 }]}
            onPress={handleStart}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.startButtonText}>Start Workout</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Exercise Search Modal */}
      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView style={styles.searchContainer}>
          <View style={styles.searchHeader}>
            <Pressable
              style={styles.searchBackButton}
              onPress={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
              <Text style={styles.searchBackText}>Back</Text>
            </Pressable>
            <Text style={styles.searchTitle}>Add Exercise</Text>
            <View style={{ width: 24 }} />
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />

          {loadingExercises ? (
            <ActivityIndicator
              color={colors.accent.primary}
              size="large"
              style={{ marginTop: spacing.xxxl }}
            />
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {groupedExercises.map(([muscle, exList]) => (
                <View key={muscle}>
                  <Text style={styles.groupLabel}>
                    {muscle.replace('_', ' ').toUpperCase()}
                  </Text>
                  {exList.map((ex) => {
                    const isAdded = exercises.some((e) => e.exercise.id === ex.id);
                    return (
                      <Pressable
                        key={ex.id}
                        style={[styles.searchItem, isAdded && styles.searchItemAdded]}
                        onPress={() => addExercise(ex)}
                        disabled={isAdded}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchItemName}>{ex.name}</Text>
                          <Text style={styles.searchItemMeta}>
                            {ex.equipment} · {ex.difficulty}
                          </Text>
                        </View>
                        {isAdded ? (
                          <Ionicons name="checkmark-circle" size={22} color={colors.accent.primary} />
                        ) : (
                          <Ionicons name="add-circle-outline" size={22} color={colors.text.tertiary} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
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
  nameInput: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: font.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  list: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: font.md,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  exerciseCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseName: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  exerciseMuscle: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  setControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  setLabel: {
    fontSize: font.sm,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.input,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: font.lg,
  },
  stepperValue: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: font.lg,
    minWidth: 24,
    textAlign: 'center',
  },
  repsInput: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.text.primary,
    fontSize: font.md,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.bg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  addButtonText: {
    color: colors.accent.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  startButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },

  searchContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  searchBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchBackText: {
    fontSize: font.sm,
    color: colors.text.primary,
    fontWeight: '600',
  },
  searchTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  searchInput: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.md,
    color: colors.text.primary,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  groupLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  searchItemAdded: {
    opacity: 0.5,
  },
  searchItemName: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  searchItemMeta: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 1,
  },
});
