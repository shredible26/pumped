import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { parseLocalDate, getLocalDateString } from '@/utils/date';
import { formatVolumeCompact, type Units } from '@/utils/units';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';

interface PastWorkoutRow {
  id: string;
  name: string;
  date: string;
  duration_seconds: number | null;
  total_volume: number | null;
  exercise_count: number | null;
  pr_count: number | null;
  is_rest_day?: boolean;
  is_cardio?: boolean;
  completed_at?: string | null;
}

interface SavedWorkout {
  id: string;
  name: string;
  workout_type: string | null;
  exercises: any;
  last_used_at: string | null;
  use_count: number;
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const units: Units = (profile as { units?: Units })?.units ?? 'lbs';

  const [pastWorkouts, setPastWorkouts] = useState<PastWorkoutRow[]>([]);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  type PastFilter = 'today' | 'week' | 'month' | 'all';
  const [pastFilter, setPastFilter] = useState<PastFilter>('today');

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const { data: raw } = await supabase
      .from('workout_sessions')
      .select('id, name, date, duration_seconds, total_volume, exercise_count, pr_count, is_rest_day, is_cardio, completed_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('date', { ascending: false })
      .order('completed_at', { ascending: false })
      .limit(500);

    if (raw) {
      const workoutsOnly = (raw as PastWorkoutRow[]).filter((s) => !s.is_rest_day);
      workoutsOnly.sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (b.completed_at ?? '').localeCompare(a.completed_at ?? '');
      });
      setPastWorkouts(workoutsOnly);
    }

    try {
      const { data: saved } = await supabase
        .from('saved_workouts')
        .select('*')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false });
      if (saved) setSavedWorkouts(saved);
    } catch {
      // Table may not exist yet
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const todayStr = getLocalDateString();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const filteredPastWorkouts = pastWorkouts.filter((w) => {
    const d = parseLocalDate(w.date);
    if (pastFilter === 'today') return w.date === todayStr;
    if (pastFilter === 'week') return isWithinInterval(d, { start: weekStart, end: weekEnd });
    if (pastFilter === 'month') return isWithinInterval(d, { start: monthStart, end: monthEnd });
    return true;
  });

  const deleteSaved = async (id: string) => {
    await supabase.from('saved_workouts').delete().eq('id', id);
    setSavedWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.primary}
          />
        }
      >
        <Text style={styles.title}>Workouts</Text>

        {/* Past Workouts — filter by Today / This Week / This Month / All */}
        <Text style={styles.sectionHeader}>Past Workouts</Text>
        <View style={styles.filterRow}>
          {(['today', 'week', 'month', 'all'] as const).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterPill, pastFilter === f && styles.filterPillActive]}
              onPress={() => setPastFilter(f)}
            >
              <Text style={[styles.filterPillText, pastFilter === f && styles.filterPillTextActive]}>
                {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>

        {pastWorkouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="barbell-outline" size={32} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>
              Complete your first workout to see it here.
            </Text>
          </View>
        ) : filteredPastWorkouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No workouts in this range</Text>
            <Text style={styles.emptySubtext}>
              {pastFilter === 'today' ? "You haven't logged a workout today." : `No workouts in this ${pastFilter}.`}
            </Text>
          </View>
        ) : (
          filteredPastWorkouts.map((w) => (
            <Pressable
              key={w.id}
              style={styles.workoutCard}
              onPress={() => router.push(`/history/${w.id}`)}
            >
              <View style={styles.workoutCardLeft}>
                <View style={styles.checkCircle}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.accent.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.workoutNameRow}>
                    <Text style={styles.workoutName}>{w.name}</Text>
                    {(w.pr_count ?? 0) > 0 && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>PR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.workoutMeta}>
                    {format(parseLocalDate(w.date), 'MMM d')}
                    {w.duration_seconds
                      ? ` · ${Math.round(w.duration_seconds / 60)} min`
                      : ''}
                    {w.total_volume != null && Number(w.total_volume) > 0
                      ? ` · ${formatVolumeCompact(Number(w.total_volume), units)}`
                      : ''}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.text.tertiary}
              />
            </Pressable>
          ))
        )}

        {/* Saved Workouts */}
        <Text style={styles.sectionHeader}>Saved Workouts</Text>
        {savedWorkouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bookmark-outline" size={28} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No saved workouts</Text>
            <Text style={styles.emptySubtext}>
              Save a workout from Speed Log to reuse it here.
            </Text>
          </View>
        ) : (
          savedWorkouts.map((sw) => {
            const exCount = Array.isArray(sw.exercises) ? sw.exercises.length : 0;
            return (
              <Pressable
                key={sw.id}
                style={styles.savedCard}
                onPress={() =>
                  router.push({
                    pathname: '/speedlog/editor',
                    params: { type: sw.workout_type ?? 'Custom' },
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedName}>{sw.name}</Text>
                  <Text style={styles.savedMeta}>
                    {exCount} exercises
                    {sw.last_used_at
                      ? ` · Last used ${formatDistanceToNow(new Date(sw.last_used_at), { addSuffix: true })}`
                      : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => deleteSaved(sw.id)}
                  hitSlop={12}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.text.tertiary} />
                </Pressable>
              </Pressable>
            );
          })
        )}

        {/* Create Custom Workout */}
        <Pressable
          style={styles.createCard}
          onPress={() => router.push('/workout/custom')}
        >
          <View style={styles.createIcon}>
            <Ionicons name="add" size={24} color={colors.accent.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.createTitle}>Create Custom Workout</Text>
            <Text style={styles.createSubtext}>
              Build a workout from scratch with any exercises
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </Pressable>

        {/* Celebrity Workouts placeholder */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>Celebrity Workouts</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>COMING SOON</Text>
          </View>
        </View>
        <View style={styles.celebCard}>
          <Ionicons name="lock-closed" size={24} color={colors.text.tertiary} />
          <Text style={styles.celebText}>
            Popular routines from athletes and influencers. Coming soon.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: font.xxxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  seeAll: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.accent.primary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterPillActive: {
    backgroundColor: colors.accent.bg,
    borderColor: colors.accent.primary,
  },
  filterPillText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterPillTextActive: {
    color: colors.accent.primary,
  },
  emptyCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptySubtext: {
    fontSize: font.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  workoutCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  workoutName: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.primary,
  },
  prBadge: {
    backgroundColor: 'rgba(250,204,21,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  prBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FACC15',
    letterSpacing: 0.5,
  },
  workoutMeta: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  savedName: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.primary,
  },
  savedMeta: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    marginTop: spacing.md,
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTitle: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.primary,
  },
  createSubtext: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  comingSoonBadge: {
    backgroundColor: colors.bg.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  celebCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    gap: spacing.md,
    opacity: 0.6,
  },
  celebText: {
    fontSize: font.md,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
