import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius } from '@/utils/theme';
import { DurationInput } from '@/components/ui/DurationInput';
import { MinuteSecondInput } from '@/components/ui/MinuteSecondInput';
import { REST_DURATIONS } from '@/utils/constants';
import { useAuthStore } from '@/stores/authStore';
import { fetchExercises } from '@/services/exercises';
import { createSession, insertSetLogs, completeSession } from '@/services/workouts';
import { generateWorkoutNameFromExercises } from '@/utils/workoutName';
import { getLocalDateString } from '@/utils/date';
import { applyWorkoutFatigue, recordWorkoutStrain } from '@/services/fatigue';
import { updateProfileStreak } from '@/services/streak';
import { supabase } from '@/services/supabase';
import { Exercise } from '@/types/exercise';
import { e1rm } from '@/utils/epley';
import { clearActiveWorkout } from '@/utils/storage';
import {
  durationPartsToSeconds,
  isDurationExercise,
  secondsToDurationParts,
  showWeightInput,
} from '@/utils/exerciseUtils';

interface SpeedSet {
  weight: string;
  reps: string;
  durationMinutes?: string;
  durationSeconds?: string;
}

interface SpeedExercise {
  exercise: Exercise;
  sets: SpeedSet[];
}

function createDurationSet(targetSeconds?: number | null): SpeedSet {
  const { minutes, seconds } = secondsToDurationParts(targetSeconds);
  return {
    weight: '0',
    reps: '0',
    durationMinutes: minutes,
    durationSeconds: seconds,
  };
}

export default function SpeedLogEditorScreen() {
  const router = useRouter();
  const { type, date: dateParam } = useLocalSearchParams<{ type: string; date?: string }>();
  const sessionAuth = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [exercises, setExercises] = useState<SpeedExercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSet, setEditingSet] = useState<{
    exIdx: number;
    setIdx: number;
  } | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    setWorkoutName(`New ${type ?? 'Custom'} Workout`);
  }, [type]);

  const loadExercises = async () => {
    setLoadingDb(true);
    try {
      const data = await fetchExercises();
      setAllExercises(data ?? []);
    } catch {
      setAllExercises([]);
    } finally {
      setLoadingDb(false);
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
    if (exercises.some((e) => e.exercise.id === exercise.id)) return;
    const durationBased = isDurationExercise(exercise);
    const allowWeight = showWeightInput(exercise);
    const defaultSets = durationBased
      ? [createDurationSet()]
      : allowWeight
        ? [{ weight: '135', reps: '8' }, { weight: '135', reps: '8' }, { weight: '135', reps: '8' }]
        : [{ weight: '0', reps: '8' }, { weight: '0', reps: '8' }, { weight: '0', reps: '8' }];
    setExercises((prev) => [
      ...prev,
      { exercise, sets: defaultSets },
    ]);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e;
        if (isDurationExercise(e.exercise)) return e;
        const lastSet = e.sets[e.sets.length - 1];
        const next = {
          weight: lastSet?.weight ?? '0',
          reps: lastSet?.reps ?? '8',
        };
        return { ...e, sets: [...e.sets, next] };
      }),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx || e.sets.length <= 1) return e;
        return { ...e, sets: e.sets.filter((_, si) => si !== setIdx) };
      }),
    );
  };

  const startEditSet = (exIdx: number, setIdx: number) => {
    const s = exercises[exIdx].sets[setIdx];
    setEditWeight(s.weight);
    setEditReps(s.reps);
    setEditingSet({ exIdx, setIdx });
  };

  const confirmEditSet = () => {
    if (!editingSet) return;
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== editingSet.exIdx) return e;
        return {
          ...e,
          sets: e.sets.map((s, si) =>
            si === editingSet.setIdx
              ? { ...s, weight: editWeight, reps: editReps }
              : s,
          ),
        };
      }),
    );
    setEditingSet(null);
  };

  const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const totalVolume = exercises.reduce(
    (sum, e) =>
      sum +
      e.sets.reduce(
        (s, set) => s + (parseFloat(set.weight) || 0) * (parseInt(set.reps, 10) || 0),
        0,
      ),
    0,
  );

  const handleLogIt = async () => {
    if (!sessionAuth?.user?.id || exercises.length === 0) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const userId = sessionAuth.user.id;
      const durationSec = durationMinutes * 60;

      const trimmed = workoutName.trim();
      const isDefaultName = !trimmed || /^New .+ Workout$/.test(trimmed);
      const resolvedName =
        !isDefaultName
          ? trimmed
          : generateWorkoutNameFromExercises(
              exercises.map((e) => ({
                primary_muscle: e.exercise.primary_muscle,
                name: e.exercise.name,
              }))
            ) || `${type || 'Custom'} Workout`;
      const sessionDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : getLocalDateString();
      const ws = await createSession({
        user_id: userId,
        date: sessionDate,
        name: resolvedName,
        workout_type: (type?.toLowerCase() as any) ?? null,
        source: 'custom',
        exercise_count: exercises.length,
        set_count: totalSets,
        total_volume: totalVolume,
        pr_count: 0,
        completed: true,
        started_at: new Date(Date.now() - durationSec * 1000).toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: durationSec,
      });

      const setLogs: any[] = [];
      const contributions: { primary_muscle: string | null; secondary_muscles?: string[]; volume: number }[] = [];

      exercises.forEach((ex, exIdx) => {
        let exVol = 0;
        const useWeight = showWeightInput(ex.exercise);
        const useDuration = isDurationExercise(ex.exercise);
        ex.sets.forEach((set, setIdx) => {
          const w = useWeight ? (parseFloat(set.weight) || 0) : 0;
          const r = useDuration ? 0 : parseInt(set.reps, 10) || 0;
          const sec = useDuration
            ? durationPartsToSeconds(set.durationMinutes, set.durationSeconds)
            : null;
          if (!useDuration) {
            exVol += w * r;
          }
          setLogs.push({
            session_id: ws.id,
            exercise_id: ex.exercise.id,
            exercise_name: ex.exercise.name,
            exercise_order: exIdx,
            set_number: setIdx + 1,
            actual_weight: useWeight && w > 0 ? w : null,
            actual_reps: useDuration ? null : r,
            actual_seconds: sec ?? undefined,
            completed: true,
            is_warmup: false,
            is_pr: false,
          });
        });
        contributions.push({
          primary_muscle: ex.exercise.primary_muscle ?? null,
          secondary_muscles: ex.exercise.secondary_muscles,
          volume: exVol,
        });
      });

      if (setLogs.length > 0) {
        await insertSetLogs(setLogs).catch(() => {});
      }

      await applyWorkoutFatigue(userId, contributions).catch(() => {});
      const completedAtForStrain = new Date(sessionDate + 'T12:00:00');
      await recordWorkoutStrain(userId, ws.id, completedAtForStrain).catch(() => {});

      const prevTotal = profile?.total_workouts ?? 0;
      await supabase
        .from('profiles')
        .update({
          total_workouts: prevTotal + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      const streakResult = await updateProfileStreak(userId);

      const { data: updated } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (updated) setProfile({ ...updated, ...streakResult } as any);

      clearActiveWorkout();

      router.push({
        pathname: '/speedlog/save',
        params: {
          sessionId: ws.id,
          type: type ?? 'Custom',
          workoutName: workoutName.trim() || `My ${type ?? 'Custom'} Day`,
          exerciseNames: exercises.map((e) => e.exercise.name).join('|'),
          exerciseSets: exercises.map((e) => e.sets.length).join('|'),
        },
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          <Text style={styles.headerBackText}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="flash" size={16} color={colors.accent.primary} />
          <Text style={styles.headerTitle}>Speed Log</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <TextInput
            style={styles.workoutTitleInput}
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder={`New ${type ?? 'Custom'} workout`}
            placeholderTextColor={colors.text.tertiary}
            selectTextOnFocus
          />
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>EDIT</Text>
          </View>
        </View>

        <View style={styles.durationRow}>
          <Ionicons name="time-outline" size={18} color={colors.text.secondary} />
          <Text style={styles.durationLabel}>Duration</Text>
          <View style={styles.durationPickerWrap}>
            <DurationInput
              totalMinutes={durationMinutes}
              onMinutesChange={setDurationMinutes}
            />
          </View>
        </View>

        {exercises.map((ex, exIdx) => (
          <View key={ex.exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{ex.exercise.name}</Text>
              <Pressable onPress={() => removeExercise(exIdx)}>
                <Ionicons name="close" size={18} color={colors.text.tertiary} />
              </Pressable>
            </View>

            {isDurationExercise(ex.exercise) ? (
              <View style={styles.durationEntryCard}>
                <View style={styles.durationEntryHeader}>
                  <View style={styles.durationEntryBadge}>
                    <Text style={styles.durationEntryBadgeText}>Duration</Text>
                  </View>
                  <Text style={styles.durationEntryHint}>Single entry</Text>
                </View>

                {showWeightInput(ex.exercise) ? (
                  <View style={styles.durationWeightWrap}>
                    <Text style={styles.durationFieldLabel}>Weight (lbs)</Text>
                    <TextInput
                      style={styles.durationWeightInput}
                      value={ex.sets[0]?.weight ?? '0'}
                      onChangeText={(value) =>
                        setExercises((prev) =>
                          prev.map((item, index) =>
                            index === exIdx
                              ? {
                                  ...item,
                                  sets: item.sets.map((set, setIdx) =>
                                    setIdx === 0 ? { ...set, weight: value } : set
                                  ),
                                }
                              : item
                          )
                        )
                      }
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.text.tertiary}
                      selectTextOnFocus
                    />
                  </View>
                ) : null}

                <MinuteSecondInput
                  minutes={ex.sets[0]?.durationMinutes ?? ''}
                  seconds={ex.sets[0]?.durationSeconds ?? ''}
                  onMinutesChange={(value) =>
                    setExercises((prev) =>
                      prev.map((item, index) =>
                        index === exIdx
                          ? {
                              ...item,
                              sets: item.sets.map((set, setIdx) =>
                                setIdx === 0 ? { ...set, durationMinutes: value } : set
                              ),
                            }
                          : item
                      )
                    )
                  }
                  onSecondsChange={(value) =>
                    setExercises((prev) =>
                      prev.map((item, index) =>
                        index === exIdx
                          ? {
                              ...item,
                              sets: item.sets.map((set, setIdx) =>
                                setIdx === 0 ? { ...set, durationSeconds: value } : set
                              ),
                            }
                          : item
                      )
                    )
                  }
                />
                <Text style={styles.durationEntryHelper}>
                  Leave either box blank if you only want to log part of the time.
                </Text>
              </View>
            ) : (
              <View style={styles.setPillRow}>
                {ex.sets.map((set, setIdx) => {
                  const showW = showWeightInput(ex.exercise);
                  const label = showW
                    ? `${set.weight} × ${set.reps}`
                    : `${set.reps} reps`;
                  return (
                    <Pressable
                      key={setIdx}
                      style={styles.setPill}
                      onPress={() => startEditSet(exIdx, setIdx)}
                      onLongPress={() => removeSet(exIdx, setIdx)}
                    >
                      <Text style={styles.setPillText}>{label}</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addSetPill} onPress={() => addSet(exIdx)}>
                  <Ionicons name="add" size={16} color={colors.accent.primary} />
                </Pressable>
              </View>
            )}
          </View>
        ))}

        <Pressable
          style={styles.addExerciseBtn}
          onPress={() => setSearchOpen(true)}
        >
          <Ionicons name="add" size={20} color={colors.accent.primary} />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </Pressable>
      </ScrollView>

      {exercises.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerSummary}>
            {exercises.length} exercises · {totalSets} sets ·{' '}
            ~{totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume} lbs
          </Text>
          <Pressable
            style={[styles.logButton, saving && { opacity: 0.6 }]}
            onPress={handleLogIt}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="flash" size={18} color={colors.text.inverse} />
                <Text style={styles.logButtonText}>Log It</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {editingSet && (
        <Modal
          visible={!!editingSet}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingSet(null)}
        >
          <Pressable style={styles.editOverlay} onPress={() => setEditingSet(null)}>
            <View style={styles.editSheet}>
              <Pressable>
                <Text style={styles.editTitle}>Edit Set</Text>
                <View style={styles.editRow}>
                  {editingSet && showWeightInput(exercises[editingSet.exIdx]?.exercise) && (
                    <View style={{ flex: 1 }}>
                      <Text style={styles.editLabel}>Weight (lbs)</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editWeight}
                        onChangeText={setEditWeight}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editLabel}>Reps</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editReps}
                      onChangeText={setEditReps}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  </View>
                </View>
                <View style={styles.editActionsRow}>
                  <Pressable
                    style={styles.deleteSetBtn}
                    onPress={() => {
                      if (editingSet) {
                        removeSet(editingSet.exIdx, editingSet.setIdx);
                        setEditingSet(null);
                      }
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.text.inverse} />
                    <Text style={styles.deleteSetText}>Delete Set</Text>
                  </Pressable>
                  <Pressable style={styles.editOkBtn} onPress={confirmEditSet}>
                    <Text style={styles.editOkText}>OK</Text>
                  </Pressable>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView style={styles.searchContainer} edges={['top']}>
          <View style={styles.searchHeader}>
            <View style={{ width: 60 }} />
            <Text style={styles.searchTitle}>Add Exercise</Text>
            <View style={{ width: 60 }} />
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {loadingDb ? (
              <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 40 }} />
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 100 }}
              >
                {groupedExercises.map(([muscle, exList]) => (
                  <View key={muscle}>
                    <Text style={styles.groupLabel}>
                      {muscle.replace('_', ' ').toUpperCase()}
                    </Text>
                    {exList.map((ex) => {
                      const added = exercises.some((e) => e.exercise.id === ex.id);
                      return (
                        <Pressable
                          key={ex.id}
                          style={styles.searchItem}
                          onPress={() => addExercise(ex)}
                          disabled={added}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.searchItemName}>{ex.name}</Text>
                            <Text style={styles.searchItemMeta}>
                              {ex.equipment} · {ex.difficulty}
                            </Text>
                          </View>
                          <Ionicons
                            name={added ? 'checkmark-circle' : 'add-circle-outline'}
                            size={22}
                            color={added ? colors.accent.primary : colors.text.tertiary}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
                <View style={{ height: 24 }} />
              </ScrollView>
            )}
            <View style={styles.searchBackFooter}>
              <Pressable
                style={styles.searchBackButton}
                onPress={() => { setSearchOpen(false); setSearchQuery(''); }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
                <Text style={styles.searchBackButtonText}>Back</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerBackText: { fontSize: font.md, fontWeight: '600', color: colors.text.primary },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text.primary },
  scroll: { flex: 1, paddingHorizontal: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  workoutTitle: { fontSize: font.xxl, fontWeight: '700', color: colors.text.primary },
  workoutTitleInput: {
    flex: 1,
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  newBadge: {
    backgroundColor: colors.accent.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  newBadgeText: { fontSize: 9, fontWeight: '700', color: colors.accent.primary, letterSpacing: 0.5 },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
  },
  durationLabel: { flex: 1, fontSize: font.md, color: colors.text.secondary },
  durationPickerWrap: { flex: 1 },
  exerciseCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  exerciseName: { fontSize: font.lg, fontWeight: '700', color: colors.text.primary },
  setPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  setPill: {
    backgroundColor: colors.bg.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  setPillText: { fontSize: font.sm, fontWeight: '600', color: colors.text.primary },
  durationEntryCard: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    gap: spacing.sm,
  },
  durationEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationEntryBadge: {
    backgroundColor: colors.accent.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  durationEntryBadgeText: {
    color: colors.accent.primary,
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  durationEntryHint: {
    fontSize: font.sm,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  durationWeightWrap: {
    marginBottom: spacing.xs,
  },
  durationFieldLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  durationWeightInput: {
    minHeight: 48,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: font.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  durationEntryHelper: {
    fontSize: font.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  addSetPill: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accent.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.bg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  addExerciseText: { color: colors.accent.primary, fontSize: font.md, fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 36,
  },
  footerSummary: {
    fontSize: font.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  logButtonText: { color: colors.text.inverse, fontSize: font.lg, fontWeight: '700' },

  searchBackFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    paddingBottom: 24,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    alignItems: 'center',
  },
  searchBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minWidth: 120,
  },
  searchBackButtonText: { fontSize: font.md, fontWeight: '600', color: colors.text.primary },

  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSheet: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '80%',
  },
  editTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
  editRow: { flexDirection: 'row', gap: spacing.md },
  editLabel: { fontSize: font.sm, color: colors.text.secondary, marginBottom: spacing.xs },
  editInput: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  editActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  deleteSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  deleteSetText: { color: colors.text.inverse, fontWeight: '700', fontSize: font.sm },
  editOkBtn: {
    flex: 1,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  editOkText: { color: colors.text.inverse, fontWeight: '700', fontSize: font.md },

  searchContainer: { flex: 1, backgroundColor: colors.bg.primary },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  searchTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text.primary },
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
  searchItemName: { fontSize: font.md, fontWeight: '600', color: colors.text.primary },
  searchItemMeta: { fontSize: font.sm, color: colors.text.secondary, marginTop: 1 },
});
