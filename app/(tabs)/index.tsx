import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, font, spacing, radius, recoveryColor } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { useFatigue } from '@/hooks/useFatigue';
import { supabase } from '@/services/supabase';
import { Profile } from '@/types/user';
import { AIWorkoutPlan } from '@/types/workout';
import BodyMap from '@/components/home/BodyMap';
import MuscleDetailSheet from '@/components/home/MuscleDetailSheet';

export default function HomeScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const { fatigueMap, refreshFatigue, loading: fatigueLoading } = useFatigue();
  const [todayPlan, setTodayPlan] = useState<AIWorkoutPlan | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) setProfile(data as Profile);
  }, [session?.user?.id]);

  const fetchTodayPlan = useCallback(async () => {
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
    setTodayPlan(data as AIWorkoutPlan | null);
  }, [session?.user?.id]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchProfile(), refreshFatigue(), fetchTodayPlan()]);
  }, [fetchProfile, refreshFatigue, fetchTodayPlan]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSelectMuscle = useCallback((muscle: string) => {
    setSelectedMuscle(muscle);
    setSheetVisible(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const streak = profile?.current_streak_days ?? 0;
  const totalWorkouts = profile?.total_workouts ?? 0;
  const strengthScore = profile?.strength_score ?? 0;
  const squat = profile?.squat_e1rm ?? 0;
  const bench = profile?.bench_e1rm ?? 0;
  const deadlift = profile?.deadlift_e1rm ?? 0;
  const trainingFreq = profile?.training_frequency ?? 0;
  const programStyle = profile?.program_style;

  const programLabel =
    programStyle === 'ppl'
      ? 'PPL'
      : programStyle === 'upper_lower'
        ? 'Upper/Lower'
        : programStyle === 'bro_split'
          ? 'Bro Split'
          : programStyle === 'full_body'
            ? 'Full Body'
            : programStyle === 'ai_optimal'
              ? 'AI'
              : '';

  const programColor = programStyle
    ? colors.program[programStyle] ?? colors.accent.primary
    : colors.accent.primary;

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
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.logo}>
            <Text style={styles.logoAccent}>P</Text>UMPED
          </Text>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>
              {streak > 0 ? `🔥 ${streak} Day Streak` : '0 Day Streak'}
            </Text>
          </View>
        </View>

        {/* Today's Workout Card */}
        <Pressable
          style={styles.todayCard}
          onPress={() =>
            todayPlan
              ? router.push('/workout/preview')
              : router.push('/workout/custom')
          }
        >
          <View style={styles.todayHeader}>
            <Text style={styles.todayLabel}>TODAY'S WORKOUT</Text>
            {programLabel ? (
              <View style={[styles.programTag, { backgroundColor: programColor + '20' }]}>
                <Text style={[styles.programTagText, { color: programColor }]}>
                  {programLabel}
                </Text>
              </View>
            ) : null}
          </View>
          {todayPlan ? (
            <>
              <Text style={styles.todayTitle}>{todayPlan.workout_name}</Text>
              <Text style={styles.todayMeta}>
                {Array.isArray(todayPlan.exercises)
                  ? `${todayPlan.exercises.length} exercises`
                  : ''}{' '}
                · ~
                {Array.isArray(todayPlan.exercises)
                  ? Math.round(todayPlan.exercises.length * 8)
                  : 0}{' '}
                min
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.todayTitle}>No workout planned</Text>
              <Text style={styles.todayMeta}>
                Tap to log a custom workout, or wait for AI to generate one
              </Text>
            </>
          )}
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/workout/custom')}>
          <Text style={styles.customLink}>or log a custom workout</Text>
        </Pressable>

        {/* Strength Score Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>STRENGTH SCORE</Text>
          {strengthScore > 0 ? (
            <>
              <Text style={styles.scoreNumber}>
                {strengthScore.toLocaleString()}
              </Text>
              <View style={styles.liftBreakdown}>
                {squat > 0 && (
                  <View style={styles.liftItem}>
                    <Text style={styles.liftValue}>{squat}</Text>
                    <Text style={styles.liftLabel}>Squat</Text>
                  </View>
                )}
                {squat > 0 && bench > 0 && <View style={styles.liftDivider} />}
                {bench > 0 && (
                  <View style={styles.liftItem}>
                    <Text style={styles.liftValue}>{bench}</Text>
                    <Text style={styles.liftLabel}>Bench</Text>
                  </View>
                )}
                {bench > 0 && deadlift > 0 && (
                  <View style={styles.liftDivider} />
                )}
                {deadlift > 0 && (
                  <View style={styles.liftItem}>
                    <Text style={styles.liftValue}>{deadlift}</Text>
                    <Text style={styles.liftLabel}>Deadlift</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.scoreNumber}>—</Text>
              <Text style={styles.cardSubtext}>
                Log your first squat, bench, or deadlift to see your score
              </Text>
            </>
          )}
        </View>

        {/* Muscle Readiness Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>MUSCLE READINESS</Text>
          <BodyMap
            fatigueMap={fatigueMap}
            onSelectMuscle={handleSelectMuscle}
          />
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {/* Week progress: we'd need to count sessions this week */}
              0/{trainingFreq}
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>PRs</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <MuscleDetailSheet
        visible={sheetVisible}
        muscle={selectedMuscle}
        fatigueMap={fatigueMap}
        onClose={handleCloseSheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  logo: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: 1,
  },
  logoAccent: {
    color: colors.accent.primary,
  },
  streakBadge: {
    backgroundColor: colors.accent.bg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  streakText: {
    color: colors.accent.primary,
    fontSize: font.sm,
    fontWeight: '600',
  },

  todayCard: {
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    position: 'relative',
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  todayLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.accent.primary,
    letterSpacing: 1,
  },
  programTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  programTagText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  todayTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  todayMeta: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  playButton: {
    position: 'absolute',
    right: spacing.xl,
    top: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: colors.text.inverse,
    fontSize: font.lg,
    marginLeft: 2,
  },
  customLink: {
    color: colors.text.tertiary,
    fontSize: font.sm,
    textAlign: 'center',
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },

  card: {
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1,
  },
  scoreNumber: {
    fontSize: font.display,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  cardSubtext: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  liftBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  liftItem: {
    alignItems: 'center',
  },
  liftValue: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  liftLabel: {
    fontSize: font.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  liftDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.light,
  },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statNumber: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: font.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
