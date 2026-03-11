import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/date';
import { colors, font, spacing, radius } from '@/utils/theme';
import { fetchSessionById, fetchSessionSets } from '@/services/workouts';
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

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Session Detail</Text>
        <View style={{ width: 24 }} />
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
                {session.total_volume >= 1000
                  ? `${(session.total_volume / 1000).toFixed(1)}k`
                  : session.total_volume}{' '}
                lbs
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
                        {set.actual_weight != null && set.actual_reps != null
                          ? `${set.actual_weight} lbs × ${set.actual_reps} reps`
                          : '—'}
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
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
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
