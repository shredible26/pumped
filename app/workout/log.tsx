import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { DurationInput } from '@/components/ui/DurationInput';
import { useAuthStore } from '@/stores/authStore';
import { getTodaysPlan } from '@/services/ai';
import { fetchExercises } from '@/services/exercises';
import {
  createSession,
  insertSetLogs,
  completeSession,
} from '@/services/workouts';
import { applyWorkoutFatigue, recordWorkoutStrain } from '@/services/fatigue';
import { updateProfileStreak } from '@/services/streak';
import { supabase } from '@/services/supabase';
import { generateWorkoutNameFromExercises } from '@/utils/workoutName';
import { getLocalDateString } from '@/utils/date';
import type { GeneratedWorkout, GeneratedExercise } from '@/services/ai';
import { Exercise } from '@/types/exercise';
import { showWeightInput, showSecondsInput, isBodyweight } from '@/utils/exerciseUtils';

interface LogSet {
  weight: string;
  reps: string;
  seconds?: string;
}

interface LogExercise {
  exercise_id: string;
  name: string;
  primary_muscle: string;
  equipment?: string;
  sets: LogSet[];
}

function planToLogExercises(plan: GeneratedWorkout, allExercises: Exercise[]): LogExercise[] {
  return (plan.exercises ?? []).map((ex) => {
    const full = allExercises.find((e) => e.id === ex.exercise_id);
    const equipment = full?.equipment ?? undefined;
    const timeBased = showSecondsInput(equipment, ex.name);
    const bw = isBodyweight(equipment);
    return {
      exercise_id: ex.exercise_id,
      name: ex.name,
      primary_muscle: ex.primary_muscle ?? '',
      equipment,
      sets: Array.from({ length: ex.sets }, () =>
        timeBased
          ? { weight: '0', reps: '0', seconds: ex.target_seconds ? String(ex.target_seconds) : '60' }
          : { weight: bw ? '0' : String(ex.target_weight_lbs ?? 0), reps: ex.target_reps?.split('-')[0] ?? '8' }
      ),
    };
  });
}

export default function WorkoutLogScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [plan, setPlan] = useState<GeneratedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<LogExercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [saving, setSaving] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSet, setEditingSet] = useState<{
    exIdx: number;
    setIdx: number;
  } | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editSeconds, setEditSeconds] = useState('');

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const [p, exList] = await Promise.all([getTodaysPlan(session.user.id), fetchExercises()]);
      setAllExercises(exList);
      setPlan(p ?? null);
      if (p) {
        setExercises(planToLogExercises(p, exList));
        setWorkoutName(p.name || 'AI Workout');
        setDurationMinutes(p.estimated_minutes ?? 45);
      } else {
        setWorkoutName('Custom Workout');
      }
      setLoading(false);
    })();
  }, [session?.user?.id]);

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e;
        const last = e.sets[e.sets.length - 1];
        const next = {
          weight: last?.weight ?? '0',
          reps: last?.reps ?? '8',
          ...(last?.seconds != null ? { seconds: last.seconds } : {}),
        };
        return { ...e, sets: [...e.sets, next] };
      })
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx || e.sets.length <= 1) return e;
        return { ...e, sets: e.sets.filter((_, si) => si !== setIdx) };
      })
    );
  };

  const updateSet = (exIdx: number, setIdx: number, weight: string, reps: string, seconds?: string) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e;
        return {
          ...e,
          sets: e.sets.map((s, si) =>
            si === setIdx ? { ...s, weight, reps, ...(seconds !== undefined ? { seconds } : {}) } : s
          ),
        };
      })
    );
    setEditingSet(null);
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const addExercise = (ex: Exercise) => {
    if (exercises.some((e) => e.exercise_id === ex.id)) return;
    const bw = isBodyweight(ex.equipment);
    const timeBased = showSecondsInput(ex.equipment, ex.name);
    const defaultSets = timeBased
      ? [{ weight: '0', reps: '0', seconds: '60' }, { weight: '0', reps: '0', seconds: '60' }, { weight: '0', reps: '0', seconds: '60' }]
      : bw
        ? [{ weight: '0', reps: '8' }, { weight: '0', reps: '8' }, { weight: '0', reps: '8' }]
        : [{ weight: '135', reps: '8' }, { weight: '135', reps: '8' }, { weight: '135', reps: '8' }];
    setExercises((prev) => [
      ...prev,
      {
        exercise_id: ex.id,
        name: ex.name,
        primary_muscle: ex.primary_muscle ?? '',
        equipment: ex.equipment,
        sets: defaultSets,
      },
    ]);
    setSearchOpen(false);
  };

  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
  const totalVolume = exercises.reduce(
    (sum, e) =>
      sum +
      e.sets.reduce(
        (s, set) =>
          s + (parseFloat(set.weight) || 0) * (parseInt(set.reps, 10) || 0),
        0
      ),
    0
  );

  const handleComplete = useCallback(async () => {
    if (!session?.user?.id || exercises.length === 0) return;
    setSaving(true);
    try {
      const durationSec = durationMinutes * 60;
      const trimmed = workoutName.trim();
      const genericNames = ['AI Workout', 'Custom Workout', 'My Workout'];
      const userSpecified = trimmed && !genericNames.includes(trimmed);
      const resolvedName = userSpecified
        ? trimmed
        : generateWorkoutNameFromExercises(
            exercises.map((e) => ({ primary_muscle: e.primary_muscle, name: e.name }))
          ) || plan?.name || 'AI Workout';
      const ws = await createSession({
        user_id: session.user.id,
        date: getLocalDateString(),
        name: resolvedName,
        workout_type: (plan?.type ?? null) as any,
        source: 'ai_generated',
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
        const useWeight = showWeightInput(ex.equipment);
        const useSeconds = showSecondsInput(ex.equipment, ex.name);
        ex.sets.forEach((set, setIdx) => {
          const w = useWeight ? (parseFloat(set.weight) || 0) : 0;
          const r = parseInt(set.reps, 10) || 0;
          const sec = useSeconds && set.seconds ? parseInt(set.seconds, 10) : null;
          exVol += w * r;
          setLogs.push({
            session_id: ws.id,
            exercise_id: ex.exercise_id,
            exercise_name: ex.name,
            exercise_order: exIdx,
            set_number: setIdx + 1,
            actual_weight: useWeight ? w : null,
            actual_reps: r,
            actual_seconds: sec ?? undefined,
            completed: true,
            is_warmup: false,
            is_pr: false,
          });
        });
        const full = allExercises.find((e) => e.id === ex.exercise_id);
        contributions.push({
          primary_muscle: ex.primary_muscle || full?.primary_muscle || null,
          secondary_muscles: full?.secondary_muscles,
          volume: exVol,
        });
      });

      await insertSetLogs(setLogs);
      await completeSession(ws.id, {
        duration_seconds: durationSec,
        total_volume: totalVolume,
        exercise_count: exercises.length,
        set_count: totalSets,
      });

      await applyWorkoutFatigue(session.user.id, contributions).catch(() => {});
      await recordWorkoutStrain(session.user.id, ws.id, new Date()).catch(() => {});

      const prevTotal = profile?.total_workouts ?? 0;
      await supabase
        .from('profiles')
        .update({
          total_workouts: prevTotal + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      const streakResult = await updateProfileStreak(session.user.id);

      const { data: updated } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (updated) setProfile({ ...updated, ...streakResult } as any);

      const today = getLocalDateString();
      await supabase
        .from('ai_workout_plans')
        .update({ used: true })
        .eq('user_id', session.user.id)
        .eq('plan_date', today);

      setCompletedSessionId(ws.id);
      setSaveModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  }, [
    session?.user?.id,
    exercises,
    durationMinutes,
    totalSets,
    totalVolume,
    plan,
    profile,
    setProfile,
    workoutName,
  ]);

  const handleSaveWorkout = async () => {
    if (!session?.user?.id || !completedSessionId) return;
    try {
      await supabase.from('saved_workouts').insert({
        user_id: session.user.id,
        name: workoutName.trim() || plan?.name || 'My Workout',
        workout_type: (plan?.type ?? null) as any,
        exercises: exercises.map((e) => ({ name: e.name, sets: e.sets.length })),
        last_used_at: new Date().toISOString(),
        use_count: 1,
      });
    } catch {}
    setSaveModalVisible(false);
    router.replace(`/workout/summary?sessionId=${completedSessionId}`);
  };

  const handleSkipSave = () => {
    setSaveModalVisible(false);
    if (completedSessionId)
      router.replace(`/workout/summary?sessionId=${completedSessionId}`);
  };

  if (loading || !plan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Workout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={styles.workoutNameInput}
          value={workoutName}
          onChangeText={setWorkoutName}
          placeholder="Workout name"
          placeholderTextColor={colors.text.tertiary}
          selectTextOnFocus
        />

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
          <View key={`${ex.exercise_id}-${exIdx}`} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <Pressable onPress={() => removeExercise(exIdx)}>
                <Ionicons name="close" size={18} color={colors.text.tertiary} />
              </Pressable>
            </View>
            <View style={styles.setPillRow}>
              {ex.sets.map((set, setIdx) => {
                const showW = showWeightInput(ex.equipment);
                const showSec = showSecondsInput(ex.equipment, ex.name);
                const label = showSec && set.seconds
                  ? `${set.seconds}s`
                  : showW
                    ? `${set.weight} × ${set.reps}`
                    : `${set.reps} reps`;
                return (
                  <Pressable
                    key={setIdx}
                    style={styles.setPill}
                    onPress={() => {
                      setEditWeight(set.weight);
                      setEditReps(set.reps);
                      setEditSeconds(set.seconds ?? '');
                      setEditingSet({ exIdx, setIdx });
                    }}
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

      <View style={styles.footer}>
        <Text style={styles.footerSummary}>
          {exercises.length} exercises · {totalSets} sets · ~
          {totalVolume >= 1000
            ? `${(totalVolume / 1000).toFixed(1)}k`
            : totalVolume}{' '}
          lbs
        </Text>
        <Pressable
          style={[styles.completeButton, saving && { opacity: 0.6 }]}
          onPress={handleComplete}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.completeButtonText}>Complete Workout</Text>
          )}
        </Pressable>
      </View>

      {/* Edit set modal */}
      <Modal
        visible={!!editingSet}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSet(null)}
      >
        <Pressable
          style={styles.editOverlay}
          onPress={() => setEditingSet(null)}
        >
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>Edit Set</Text>
            <View style={styles.editRow}>
              {editingSet && showWeightInput(exercises[editingSet.exIdx]?.equipment) && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>Weight (lbs)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editWeight}
                    onChangeText={setEditWeight}
                    keyboardType="numeric"
                  />
                </View>
              )}
              {editingSet && showSecondsInput(exercises[editingSet.exIdx]?.equipment, exercises[editingSet.exIdx]?.name) ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>Seconds</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editSeconds}
                    onChangeText={setEditSeconds}
                    keyboardType="numeric"
                    placeholder="sec"
                  />
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>Reps</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editReps}
                    onChangeText={setEditReps}
                    keyboardType="numeric"
                  />
                </View>
              )}
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
              <Pressable
                style={styles.editOkBtn}
                onPress={() => {
                  if (editingSet) {
                    const ex = exercises[editingSet.exIdx];
                    const isSec = showSecondsInput(ex?.equipment, ex?.name);
                    updateSet(
                      editingSet.exIdx,
                      editingSet.setIdx,
                      editWeight,
                      isSec ? '0' : editReps,
                      isSec ? editSeconds : undefined
                    );
                  }
                }}
              >
                <Text style={styles.editOkText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Add exercise search */}
      <Modal
        visible={searchOpen}
        animationType="slide"
        onRequestClose={() => setSearchOpen(false)}
      >
        <SafeAreaView style={styles.searchContainer}>
          <View style={styles.searchHeader}>
            <Pressable onPress={() => setSearchOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>
            <Text style={styles.searchTitle}>Add Exercise</Text>
            <View style={{ width: 24 }} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <ScrollView style={{ flex: 1 }}>
            {allExercises
              .filter(
                (e) =>
                  !searchQuery.trim() ||
                  e.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .slice(0, 50)
              .map((ex) => (
                <Pressable
                  key={ex.id}
                  style={styles.searchItem}
                  onPress={() => addExercise(ex)}
                >
                  <Text style={styles.searchItemName}>{ex.name}</Text>
                  <Text style={styles.searchItemMeta}>{ex.primary_muscle}</Text>
                </Pressable>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Save workout modal */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSkipSave}
      >
        <Pressable style={styles.saveOverlay} onPress={handleSkipSave}>
          <View style={styles.saveSheet}>
            <View style={styles.saveIconCircle}>
              <Ionicons name="bookmark" size={28} color={colors.accent.primary} />
            </View>
            <Text style={styles.saveTitle}>Save This Workout?</Text>
            <Text style={styles.saveSubtitle}>Reuse it next time</Text>
            <Text style={styles.saveWorkoutNameDisplay}>
              {workoutName.trim() || plan?.name || 'My Workout'}
            </Text>
            {exercises.slice(0, 5).map((e, i) => (
              <View key={i} style={styles.saveExRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.accent.primary} />
                <Text style={styles.saveExName}>{e.name}</Text>
                <Text style={styles.saveExSets}>{e.sets.length} sets</Text>
              </View>
            ))}
            <Pressable style={styles.saveButton} onPress={handleSaveWorkout}>
              <Text style={styles.saveButtonText}>Save Workout</Text>
            </Pressable>
            <Pressable style={styles.skipButton} onPress={handleSkipSave}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { fontSize: font.md, color: colors.text.secondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scroll: { flex: 1, paddingHorizontal: spacing.xl },
  workoutNameInput: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
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
  addExerciseText: {
    color: colors.accent.primary,
    fontSize: font.md,
    fontWeight: '600',
  },
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
    width: '85%',
  },
  editTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
  editRow: { flexDirection: 'row', gap: spacing.md },
  editLabel: { fontSize: font.sm, color: colors.text.secondary, marginBottom: spacing.xs },
  editInput: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: font.lg,
    color: colors.text.primary,
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
    padding: spacing.xl,
  },
  searchTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text.primary },
  searchInput: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    fontSize: font.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  searchItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  searchItemName: { fontSize: font.md, fontWeight: '600', color: colors.text.primary },
  searchItemMeta: { fontSize: font.sm, color: colors.text.secondary, marginTop: 2 },
  saveOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveSheet: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
  },
  saveIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.bg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  saveTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text.primary, textAlign: 'center' },
  saveSubtitle: { fontSize: font.sm, color: colors.text.secondary, textAlign: 'center', marginTop: 4 },
  saveWorkoutNameDisplay: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.accent.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  saveExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveExName: { flex: 1, fontSize: font.md, color: colors.text.primary },
  saveExSets: { fontSize: font.sm, color: colors.text.secondary },
  saveButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: { color: colors.text.inverse, fontWeight: '700', fontSize: font.lg },
  skipButton: { alignItems: 'center', marginTop: spacing.md },
  skipText: { color: colors.text.tertiary, fontSize: font.md, fontWeight: '600' },
});
