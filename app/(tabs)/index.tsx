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
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
} from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { useFatigue } from '@/hooks/useFatigue';
import { supabase } from '@/services/supabase';
import { Profile } from '@/types/user';
import BodyMap from '@/components/home/BodyMap';
import MuscleDetailSheet from '@/components/home/MuscleDetailSheet';

const PROGRAM_LABELS: Record<string, string> = {
  ppl: 'Push/Pull/Legs',
  upper_lower: 'Upper/Lower',
  bro_split: 'Bro Split',
  full_body: 'Full Body',
  ai_optimal: 'AI Optimal',
};

const PPL_ROTATION = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'];
const UL_ROTATION = ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'];
const BRO_ROTATION = ['Chest/Tris', 'Back/Bis', 'Shoulders', 'Legs', 'Arms', 'Rest', 'Rest'];
const FB_ROTATION = ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'];

function getTodayWorkoutType(programStyle: string | undefined): string {
  const dayOfWeek = new Date().getDay();
  switch (programStyle) {
    case 'ppl': return PPL_ROTATION[dayOfWeek] ?? 'Push';
    case 'upper_lower': return UL_ROTATION[dayOfWeek] ?? 'Upper';
    case 'bro_split': return BRO_ROTATION[dayOfWeek] ?? 'Chest/Tris';
    case 'full_body': return FB_ROTATION[dayOfWeek] ?? 'Full Body';
    case 'ai_optimal': return 'AI Workout';
    default: return 'Workout';
  }
}

export default function TodayScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const { fatigueMap, refreshFatigue } = useFatigue();
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [workoutDaysThisWeek, setWorkoutDaysThisWeek] = useState<string[]>([]);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) setProfile(data as Profile);
  }, [session?.user?.id]);

  const fetchWeekWorkouts = useCallback(async () => {
    if (!session?.user?.id) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const weekEnd = addDays(weekStart, 6);
    const { data } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('user_id', session.user.id)
      .eq('completed', true)
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'));
    if (data) {
      setWorkoutDaysThisWeek(data.map((d: any) => d.date));
    }
  }, [session?.user?.id]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchProfile(), refreshFatigue(), fetchWeekWorkouts()]);
  }, [fetchProfile, refreshFatigue, fetchWeekWorkouts]);

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

  const streak = profile?.current_streak_days ?? 0;
  const totalWorkouts = profile?.total_workouts ?? 0;
  const trainingFreq = profile?.training_frequency ?? 0;
  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';
  const todayType = getTodayWorkoutType(profile?.program_style);
  const isRestDay = todayType === 'Rest';
  const programLabel = profile?.program_style
    ? PROGRAM_LABELS[profile.program_style] ?? ''
    : '';

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekWorkoutCount = workoutDaysThisWeek.length;

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
        {/* Weekly Calendar Strip */}
        <View style={styles.calendarStrip}>
          {weekDays.map((day) => {
            const today = isToday(day);
            const hasWorkout = workoutDaysThisWeek.includes(
              format(day, 'yyyy-MM-dd'),
            );
            return (
              <View
                key={day.toISOString()}
                style={[styles.calendarDay, today && styles.calendarDayToday]}
              >
                <Text
                  style={[
                    styles.calendarDayLabel,
                    today && styles.calendarDayLabelToday,
                  ]}
                >
                  {format(day, 'EEE').toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.calendarDate,
                    today && styles.calendarDateToday,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                {hasWorkout && <View style={styles.calendarDot} />}
              </View>
            );
          })}
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome, {firstName}</Text>
          <Text style={styles.welcomeSubtext}>
            {isRestDay
              ? 'Rest day — recover and grow'
              : `${todayType} day scheduled`}
          </Text>
        </View>

        {/* Today's Workout Card */}
        {!isRestDay && (
          <View style={styles.workoutCard}>
            <View style={styles.workoutCardHeader}>
              <View style={styles.scheduledBadge}>
                <Text style={styles.scheduledBadgeText}>SCHEDULED</Text>
              </View>
              <View style={styles.workoutIconBox}>
                <Ionicons name="barbell" size={18} color={colors.accent.primary} />
              </View>
            </View>

            <Text style={styles.workoutType}>{todayType}</Text>
            <View style={styles.programRow}>
              <Text style={styles.programName}>{programLabel}</Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.text.tertiary}
              />
            </View>

            <Pressable
              style={styles.startButton}
              onPress={() => router.push('/workout/preview')}
            >
              <Ionicons name="play" size={18} color={colors.text.inverse} />
              <Text style={styles.startButtonText}>Start Workout</Text>
            </Pressable>

            <Pressable
              style={styles.speedLogButton}
              onPress={() => router.push('/speedlog')}
            >
              <Ionicons
                name="flash"
                size={18}
                color={colors.text.primary}
              />
              <Text style={styles.speedLogButtonText}>Speed Log</Text>
            </Pressable>
          </View>
        )}

        {isRestDay && (
          <View style={styles.restCard}>
            <Text style={styles.restEmoji}>🧘</Text>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.restSubtext}>
              Your muscles are recovering. Come back stronger tomorrow.
            </Text>
            <Pressable
              style={styles.speedLogButton}
              onPress={() => router.push('/speedlog')}
            >
              <Ionicons name="flash" size={18} color={colors.text.primary} />
              <Text style={styles.speedLogButtonText}>
                Log a workout anyway
              </Text>
            </Pressable>
          </View>
        )}

        {/* Muscle Readiness */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>MUSCLE READINESS</Text>
          </View>
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
              {streak > 0 ? `🔥 ${streak}` : '0'}
            </Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {weekWorkoutCount}/{trainingFreq}
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <MuscleDetailSheet
        visible={sheetVisible}
        muscle={selectedMuscle}
        fatigueMap={fatigueMap}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  calendarDay: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minWidth: 42,
  },
  calendarDayToday: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  calendarDayLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  calendarDayLabelToday: {
    color: colors.accent.primary,
  },
  calendarDate: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 2,
  },
  calendarDateToday: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent.primary,
    marginTop: 3,
  },

  welcomeSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  welcomeText: {
    fontSize: font.xxxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  welcomeSubtext: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  workoutCard: {
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scheduledBadge: {
    backgroundColor: colors.accent.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  scheduledBadgeText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.accent.primary,
    letterSpacing: 1,
  },
  workoutIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(74,222,128,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutType: {
    fontSize: font.xxxl,
    fontWeight: '800',
    color: colors.text.primary,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  programName: {
    fontSize: font.sm,
    color: colors.text.tertiary,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  startButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
  speedLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  speedLogButtonText: {
    color: colors.text.primary,
    fontSize: font.md,
    fontWeight: '600',
  },

  restCard: {
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  restEmoji: {
    fontSize: 36,
  },
  restTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  restSubtext: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1,
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
