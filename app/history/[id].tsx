import { useState, useEffect, useCallback } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/date';
import { formatWeight, formatVolumeCompact, type Units } from '@/utils/units';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';
import { fetchSessionById, fetchSessionSets, deleteSession, updateSession } from '@/services/workouts';
import { recalculateProfileMetrics } from '@/services/profileMetrics';
import type { WorkoutSession, SetLog } from '@/types/workout';

function groupSetsByExercise(sets: SetLog[]): { name: string; sets: SetLog[] }[] {
  const byOrder = new Map<number, SetLog[]>();
  for (const s of sets) {
    const list = byOrder.get(s.exercise_order) ?? [];
    list.push(s);
    byOrder.set(s.exercise_order, list);
  }
  const orders = [...byOrder.keys()].sort((a, b) => a - b);
  return orders.map((order) => {
    const list = byOrder.get(order)!;
    const name = list[0]?.exercise_name ?? 'Exercise';
    return { name, sets: list.sort((a, b) => a.set_number - b.set_number) };
  });
}

function formatLoggedSetValue(set: SetLog, units: Units): string {
  const seconds = set.actual_seconds != null ? Number(set.actual_seconds) : null;
  if (seconds != null && seconds > 0) {
    return `${seconds}s`;
  }

  const reps = set.actual_reps != null ? Number(set.actual_reps) : null;
  const weight = set.actual_weight != null ? Number(set.actual_weight) : null;

  if (reps != null && reps > 0) {
    if (weight != null && weight > 0) {
      return `${formatWeight(weight, units)} × ${reps} reps`;
    }
    return `${reps} reps`;
  }

  return '—';
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const authSession = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const units: Units = (profile as { units?: Units })?.units ?? 'lbs';
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDurationMin, setEditDurationMin] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [sess, setLogs] = await Promise.all([
        fetchSessionById(id),
        fetchSessionSets(id),
      ]);
      setSession(sess ?? null);
      setSets(setLogs ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Session Detail</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Session Detail</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Session not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRestDay = session.is_rest_day === true;
  const isCardio = session.is_cardio === true;
  const durationMin = session.duration_seconds
    ? Math.round(session.duration_seconds / 60)
    : null;
  const grouped = groupSetsByExercise(sets);

  const handleDelete = () => {
    Alert.alert(
      'Delete workout',
      'This will permanently remove this workout from your history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setDeleting(true);
            try {
              await deleteSession(id);
              if (authSession?.user?.id) {
                const updatedProfile = await recalculateProfileMetrics(authSession.user.id);
                if (updatedProfile) {
                  setProfile(updatedProfile as any);
                }
              }
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete workout');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const openEdit = () => {
    setEditName(session.name);
    setEditDurationMin(session.duration_seconds ? String(Math.round(session.duration_seconds / 60)) : '');
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    const name = editName.trim() || session.name;
    const mins = parseInt(editDurationMin, 10);
    const duration_seconds = Number.isNaN(mins) || mins < 0 ? null : mins * 60;
    try {
      await updateSession(id, { name, duration_seconds: duration_seconds ?? undefined });
      setSession((s) => (s ? { ...s, name, duration_seconds } : null));
      setEditVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update workout');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Session Detail</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={openEdit} style={styles.headerButton} disabled={deleting}>
            <Ionicons name="pencil" size={20} color={colors.accent.primary} />
            <Text style={styles.headerButtonText}>Edit</Text>
          </Pressable>
          <Pressable onPress={handleDelete} style={[styles.headerButton, styles.headerButtonDanger]} disabled={deleting}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.headerButtonText, styles.headerButtonTextDanger]}>Delete</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sessionName}>{session.name}</Text>
        <Text style={styles.date}>{format(parseLocalDate(session.date), 'EEEE, MMMM d, yyyy')}</Text>

        <View style={styles.statsRow}>
          {durationMin != null && (
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.statText}>{durationMin} min</Text>
            </View>
          )}
          {!isRestDay && !isCardio && session.total_volume > 0 && (
            <View style={styles.stat}>
              <Ionicons name="barbell-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.statText}>
                {formatVolumeCompact(session.total_volume, units)}
              </Text>
            </View>
          )}
          {!isRestDay && !isCardio && (
            <View style={styles.stat}>
              <Text style={styles.statText}>
                {session.exercise_count} exercises · {session.set_count} sets
              </Text>
            </View>
          )}
        </View>

        {isRestDay && (
          <View style={styles.restBlock}>
            <Text style={styles.restEmoji}>🧘</Text>
            <Text style={styles.restLabel}>Rest day logged</Text>
          </View>
        )}

        {isCardio && durationMin != null && (
          <View style={styles.cardioBlock}>
            <Ionicons name="bicycle" size={24} color={colors.accent.primary} />
            <Text style={styles.cardioLabel}>Cardio · {durationMin} min</Text>
          </View>
        )}

        {!isRestDay && !isCardio && grouped.length > 0 && (
          <View style={styles.exercisesSection}>
            <Text style={styles.sectionLabel}>EXERCISES</Text>
            {grouped.map(({ name, sets: exerciseSets }) => (
              <View key={name + exerciseSets[0]?.id} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{name}</Text>
                <View style={styles.setsList}>
                  {exerciseSets.map((set) => (
                    <View key={set.id} style={styles.setRow}>
                      <Text style={styles.setLabel}>Set {set.set_number}</Text>
                      <Text style={styles.setValue}>
                        {formatLoggedSetValue(set, units)}
                      </Text>
                      {set.is_pr && (
                        <View style={styles.prBadge}>
                          <Text style={styles.prText}>PR</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {!isRestDay && !isCardio && sets.length === 0 && (
          <Text style={styles.noSets}>No sets logged for this session.</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardWrap}
          >
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Edit workout</Text>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Workout name"
                placeholderTextColor={colors.text.tertiary}
              />
              <Text style={styles.inputLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.textInput}
                value={editDurationMin}
                onChangeText={setEditDurationMin}
                placeholder="e.g. 45"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
              />
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalButtonSecondary} onPress={() => setEditVisible(false)}>
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalButtonPrimary} onPress={saveEdit}>
                  <Text style={styles.modalButtonPrimaryText}>Save</Text>
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
  sessionName: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.text.primary,
  },
  date: {
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
  restBlock: {
    marginTop: spacing.xl,
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  restEmoji: { fontSize: 40 },
  restLabel: {
    fontSize: font.lg,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  cardioBlock: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardioLabel: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.primary,
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
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  setLabel: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    width: 56,
  },
  setValue: {
    flex: 1,
    fontSize: font.md,
    color: colors.text.primary,
  },
  prBadge: {
    backgroundColor: colors.accent.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  prText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  noSets: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.xl,
    fontStyle: 'italic',
  },
});
