import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { formatDurationLabel } from '@/utils/exerciseUtils';
import { formatWeight, type Units } from '@/utils/units';
import {
  deleteSavedWorkout,
  fetchSavedWorkoutById,
  normalizeSavedWorkoutExercises,
  updateSavedWorkout,
  type SavedWorkoutRecord,
} from '@/services/savedWorkouts';

function formatWorkoutTypeLabel(workoutType: string | null): string {
  if (!workoutType) return 'Saved workout';
  return workoutType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SavedWorkoutDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const units: Units = (profile as { units?: Units })?.units ?? 'lbs';

  const [savedWorkout, setSavedWorkout] = useState<SavedWorkoutRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const exercises = useMemo(
    () => normalizeSavedWorkoutExercises(savedWorkout?.exercises),
    [savedWorkout?.exercises],
  );

  const load = useCallback(async () => {
    if (!session?.user?.id || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchSavedWorkoutById(session.user.id, id);
      setSavedWorkout(data);
      if (data) {
        setEditName(data.name);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load saved workout');
    } finally {
      setLoading(false);
    }
  }, [id, session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = () => {
    if (!savedWorkout) return;
    setEditName(savedWorkout.name);
    setEditVisible(true);
  };

  const handleSaveEdit = useCallback(async () => {
    if (!savedWorkout?.id || !session?.user?.id) return;

    const name = editName.trim();
    if (!name) {
      Alert.alert('Enter a name', 'Saved workouts need a title.');
      return;
    }

    setSavingEdit(true);
    try {
      await updateSavedWorkout(session.user.id, savedWorkout.id, { name });
      setSavedWorkout((current) => (current ? { ...current, name } : current));
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update saved workout');
    } finally {
      setSavingEdit(false);
    }
  }, [editName, savedWorkout?.id, session?.user?.id]);

  const handleDelete = useCallback(() => {
    if (!savedWorkout?.id || !session?.user?.id) return;

    Alert.alert(
      'Delete saved workout',
      'This will permanently remove this saved workout. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteSavedWorkout(session.user.id, savedWorkout.id);
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to delete saved workout');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [router, savedWorkout?.id, session?.user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Saved Workout</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !savedWorkout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Saved Workout</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Saved workout not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const exerciseCount = exercises.length;
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);

  const formatSetValue = (set: { weight?: number | null; reps?: number | null; seconds?: number | null }) => {
    if (set.seconds != null && set.seconds > 0) {
      if (set.weight != null && set.weight > 0) {
        return `${formatWeight(set.weight, units)} × ${formatDurationLabel(set.seconds)}`;
      }
      return formatDurationLabel(set.seconds);
    }

    if (set.weight != null && set.weight > 0 && set.reps != null && set.reps > 0) {
      return `${formatWeight(set.weight, units)} × ${set.reps} reps`;
    }

    if (set.reps != null && set.reps > 0) {
      return `${set.reps} reps`;
    }

    if (set.weight != null && set.weight > 0) {
      return formatWeight(set.weight, units);
    }

    return '—';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Workout</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={openEdit} style={styles.headerButton} disabled={deleting}>
            <Ionicons name="pencil" size={20} color={colors.accent.primary} />
            <Text style={styles.headerButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={[styles.headerButton, styles.headerButtonDanger]}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.headerButtonText, styles.headerButtonTextDanger]}>
              Delete
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.workoutName}>{savedWorkout.name}</Text>
        <Text style={styles.metaLine}>
          {formatWorkoutTypeLabel(savedWorkout.workout_type)}
          {savedWorkout.last_used_at
            ? ` · Last used ${formatDistanceToNow(new Date(savedWorkout.last_used_at), { addSuffix: true })}`
            : ''}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="barbell-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.statText}>
              {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="layers-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.statText}>
              {totalSets} set{totalSets === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="bookmark-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.statText}>
              Used {savedWorkout.use_count ?? 0} time{savedWorkout.use_count === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        <View style={styles.exercisesSection}>
          <Text style={styles.sectionLabel}>EXERCISES</Text>
          {exercises.length > 0 ? (
            exercises.map((exercise, index) => (
              <View key={`${exercise.name}-${index}`} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <View style={styles.setsList}>
                  {exercise.set_details.map((set) => (
                    <View key={`${exercise.name}-${set.set_number}`} style={styles.setRow}>
                      <Text style={styles.setLabel}>Set {set.set_number}</Text>
                      <Text style={styles.setValue}>{formatSetValue(set)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="list-outline" size={28} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No exercise data saved</Text>
              <Text style={styles.emptySubtext}>
                This saved workout does not have any stored exercises yet.
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardWrap}
          >
            <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>Edit saved workout</Text>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Workout name"
                placeholderTextColor={colors.text.tertiary}
                editable={!savingEdit}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalButtonSecondary}
                  onPress={() => setEditVisible(false)}
                  disabled={savingEdit}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalButtonPrimary}
                  onPress={() => void handleSaveEdit()}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator color={colors.text.inverse} />
                  ) : (
                    <Text style={styles.modalButtonPrimaryText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerButtonDanger: {},
  headerButtonText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.accent.primary,
  },
  headerButtonTextDanger: {
    color: colors.error,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: font.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  workoutName: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.text.primary,
  },
  metaLine: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    fontSize: font.sm,
    color: colors.text.secondary,
  },
  exercisesSection: { marginTop: spacing.xl },
  sectionLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  exerciseCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  exerciseName: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  setsList: { gap: spacing.xs },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  setLabel: {
    fontSize: font.sm,
    color: colors.text.secondary,
  },
  setValue: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalKeyboardWrap: {
    width: '100%',
  },
  modalSheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: font.md,
    color: colors.text.primary,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: font.md,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalButtonSecondaryText: {
    color: colors.text.secondary,
    fontSize: font.md,
  },
});
