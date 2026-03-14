import { useState, useCallback, useEffect, useRef } from 'react';
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
import {
  format,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfDay,
  addDays,
  isSameDay,
  isToday,
  isAfter,
} from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { getStoredTodaysPlan, usePlanStore } from '@/stores/planStore';
import { useFatigue } from '@/hooks/useFatigue';
import { supabase } from '@/services/supabase';
import { getTodaysPlan } from '@/services/ai';
import { updateProfileStreak } from '@/services/streak';
import { getHistoricalFatigueMap } from '@/services/fatigue';
import { Profile } from '@/types/user';
import BodyMap from '@/components/home/BodyMap';
import MuscleDetailSheet from '@/components/home/MuscleDetailSheet';
import RoutineTimeline from '@/components/home/RoutineTimeline';
import type { GeneratedWorkout } from '@/services/ai';
import { fetchCompletedWorkoutCount } from '@/services/workouts';
import { getWorkoutTypeForDate, getDisplayWorkoutType } from '@/utils/schedule';
import { getLocalDateString } from '@/utils/date';

const PROGRAM_LABELS: Record<string, string> = {
  ppl: 'Push/Pull/Legs',
  upper_lower: 'Upper/Lower',
  aesthetic: 'Aesthetic',
  ai_optimal: 'AI Optimal',
};

function getTodayWorkoutType(
  programStyle: string | undefined,
  trainingFrequency: number
): string {
  return getWorkoutTypeForDate(programStyle, new Date(), trainingFrequency);
}

type SessionForDate = { id: string; name: string; date: string; completed_at?: string; is_rest_day?: boolean };

export default function TodayScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setTodaysPlan = usePlanStore((s) => s.setTodaysPlan);
  const clearTodaysPlan = usePlanStore((s) => s.clearTodaysPlan);

  const { fatigueMap, refreshFatigue } = useFatigue();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [workoutDaysThisWeek, setWorkoutDaysThisWeek] = useState<string[]>([]);
  const [restDaysThisWeek, setRestDaysThisWeek] = useState<string[]>([]);
  /** Dates (yyyy-MM-dd) this week where user logged a workout, rest day, or cardio */
  const [activityDaysThisWeek, setActivityDaysThisWeek] = useState<string[]>([]);
  const [activityDaysInSelectedMonth, setActivityDaysInSelectedMonth] = useState<string[]>([]);
  const [cachedPlan, setCachedPlan] = useState<GeneratedWorkout | null>(null);
  const [sessionsForSelectedDate, setSessionsForSelectedDate] = useState<SessionForDate[]>([]);
  const [historicalFatigueMap, setHistoricalFatigueMap] = useState<Array<{ muscle_group: string; recovery_pct: number | null; last_trained_at: string | null }>>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const calendarStripRef = useRef<ScrollView | null>(null);
  const calendarDayPositionsRef = useRef<Record<string, number>>({});
  const lastScrolledMonthKeyRef = useRef<string | null>(null);

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
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(weekEnd, 'yyyy-MM-dd');
    const { data: workoutData } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('user_id', session.user.id)
      .eq('completed', true)
      .or('is_rest_day.is.null,is_rest_day.eq.false')
      .gte('date', from)
      .lte('date', to);
    const { data: restData } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('user_id', session.user.id)
      .eq('is_rest_day', true)
      .gte('date', from)
      .lte('date', to);
    const { data: cardioData } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('user_id', session.user.id)
      .eq('completed', true)
      .eq('is_cardio', true)
      .gte('date', from)
      .lte('date', to);
    if (workoutData) setWorkoutDaysThisWeek([...new Set(workoutData.map((d: any) => d.date))]);
    if (restData) setRestDaysThisWeek([...new Set(restData.map((d: any) => d.date))]);
    const allActivityDates = new Set<string>([
      ...(workoutData ?? []).map((d: any) => d.date),
      ...(restData ?? []).map((d: any) => d.date),
      ...(cardioData ?? []).map((d: any) => d.date),
    ]);
    setActivityDaysThisWeek([...allActivityDates]);
  }, [session?.user?.id]);

  const fetchMonthActivityDays = useCallback(
    async (date: Date) => {
      if (!session?.user?.id) return;
      const from = format(startOfMonth(date), 'yyyy-MM-dd');
      const to = format(endOfMonth(date), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('date')
        .eq('user_id', session.user.id)
        .or('completed.eq.true,is_rest_day.eq.true')
        .gte('date', from)
        .lte('date', to);

      if (error) return;

      setActivityDaysInSelectedMonth([...new Set((data ?? []).map((row: { date: string }) => row.date))]);
    },
    [session?.user?.id]
  );

  const fetchCachedPlan = useCallback(async () => {
    if (!session?.user?.id) {
      setCachedPlan(null);
      return;
    }

    const planDate = getLocalDateString();
    const storedPlan = getStoredTodaysPlan(session.user.id, planDate);
    if (storedPlan) {
      setCachedPlan(storedPlan);
    }

    const plan = await getTodaysPlan(session.user.id);
    if (plan) {
      setTodaysPlan(session.user.id, planDate, plan);
      setCachedPlan(plan);
    } else if (!storedPlan) {
      clearTodaysPlan(session.user.id);
      setCachedPlan(null);
    }
  }, [clearTodaysPlan, session?.user?.id, setTodaysPlan]);

  const fetchSessionsForDate = useCallback(
    async (date: Date) => {
      if (!session?.user?.id) return;
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('workout_sessions')
        .select('id, name, date, completed_at, is_rest_day')
        .eq('user_id', session.user.id)
        .eq('date', dateStr)
        .eq('completed', true)
        .order('completed_at', { ascending: true });
      const rows = (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        date: r.date,
        completed_at: r.completed_at,
        is_rest_day: r.is_rest_day,
      }));
      const hasWorkout = rows.some((r: SessionForDate) => !r.is_rest_day);
      const toShow = hasWorkout ? rows.filter((r: SessionForDate) => !r.is_rest_day) : rows;
      setSessionsForSelectedDate(toShow);
    },
    [session?.user?.id]
  );

  const loadData = useCallback(async () => {
    const userId = session?.user?.id;

    await Promise.all([
      fetchProfile(),
      refreshFatigue(),
      fetchWeekWorkouts(),
      fetchCachedPlan(),
      userId
        ? fetchCompletedWorkoutCount(userId)
            .then(setTotalWorkouts)
            .catch(() => setTotalWorkouts(0))
        : Promise.resolve(setTotalWorkouts(0)),
    ]);
    if (userId) {
      try {
        const streakResult = await updateProfileStreak(userId);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (profileData) setProfile({ ...profileData, ...streakResult } as Profile);
      } catch {}
    }
  }, [fetchProfile, refreshFatigue, fetchWeekWorkouts, fetchCachedPlan, session?.user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchSessionsForDate(selectedDate);
  }, [selectedDate, fetchSessionsForDate]);

  const selectedMonthKey = format(selectedDate, 'yyyy-MM');
  const monthDays = eachDayOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate),
  });

  const scrollCalendarToSelectedDay = useCallback(() => {
    const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
    const selectedDayX = calendarDayPositionsRef.current[selectedDateKey];
    if (selectedDayX == null) return;

    const scrollOffset = Math.max(0, selectedDayX - spacing.xl);
    calendarStripRef.current?.scrollTo({ x: scrollOffset, animated: false });
  }, [selectedDate]);

  useEffect(() => {
    void fetchMonthActivityDays(selectedDate);
  }, [fetchMonthActivityDays, selectedMonthKey, selectedDate]);

  useEffect(() => {
    calendarDayPositionsRef.current = {};
    lastScrolledMonthKeyRef.current = null;

    const timeout = setTimeout(() => {
      if (lastScrolledMonthKeyRef.current === selectedMonthKey) return;
      scrollCalendarToSelectedDay();
      lastScrolledMonthKeyRef.current = selectedMonthKey;
    }, 0);

    return () => clearTimeout(timeout);
  }, [scrollCalendarToSelectedDay, selectedMonthKey]);

  useFocusEffect(
    useCallback(() => {
      fetchSessionsForDate(selectedDate);
      fetchWeekWorkouts();
      fetchMonthActivityDays(selectedDate);
      refreshFatigue();
      fetchCachedPlan();
      if (session?.user?.id && !isSameDay(selectedDate, new Date()) && !isAfter(startOfDay(selectedDate), startOfDay(new Date()))) {
        getHistoricalFatigueMap(session.user.id, selectedDate).then(setHistoricalFatigueMap);
      }
    }, [selectedDate, fetchSessionsForDate, fetchWeekWorkouts, fetchMonthActivityDays, refreshFatigue, fetchCachedPlan, session?.user?.id])
  );

  useEffect(() => {
    const isFuture = isAfter(startOfDay(selectedDate), startOfDay(new Date()));
    if (!session?.user?.id || isSameDay(selectedDate, new Date()) || isFuture) {
      setHistoricalFatigueMap([]);
      return;
    }
    let cancelled = false;
    getHistoricalFatigueMap(session.user.id, selectedDate).then((data) => {
      if (!cancelled) setHistoricalFatigueMap(data);
    });
    return () => { cancelled = true; };
  }, [selectedDate, session?.user?.id]);

  const REFRESH_TIMEOUT_MS = 15000;
  const onRefresh = useCallback(async () => {
    if (!session?.user?.id) return;
    setRefreshing(true);
    try {
      await Promise.race([
        Promise.all([loadData(), fetchMonthActivityDays(selectedDate)]).then(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } catch {
      // Avoid refresh errors (e.g. network) from breaking the screen
    } finally {
      setRefreshing(false);
    }
  }, [fetchMonthActivityDays, loadData, selectedDate, session?.user?.id]);

  const handleSelectMuscle = useCallback((muscle: string) => {
    setSelectedMuscle(muscle);
    setSheetVisible(true);
  }, []);

  const streak = profile?.current_streak_days ?? 0;
  const trainingFreq = profile?.training_frequency ?? 4;
  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';
  const todayType = getTodayWorkoutType(profile?.program_style, trainingFreq);
  const selectedDateType = getWorkoutTypeForDate(
    profile?.program_style,
    selectedDate,
    trainingFreq
  );
  const isRestDay = todayType === 'Rest';
  const programLabel = profile?.program_style
    ? PROGRAM_LABELS[profile.program_style] ?? ''
    : '';

  const weekWorkoutCount = workoutDaysThisWeek.length;
  const isSelectedToday = isSameDay(selectedDate, new Date());
  const isSelectedFuture = isAfter(startOfDay(selectedDate), startOfDay(new Date()));

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
        {/* Monthly Calendar Strip — tappable for all days in the selected month */}
        <ScrollView
          ref={calendarStripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.calendarStrip}
          contentContainerStyle={styles.calendarStripContent}
          onContentSizeChange={() => {
            if (lastScrolledMonthKeyRef.current === selectedMonthKey) return;
            scrollCalendarToSelectedDay();
            lastScrolledMonthKeyRef.current = selectedMonthKey;
          }}
        >
          {monthDays.map((day, index) => {
            const today = isToday(day);
            const selected = isSameDay(day, selectedDate);
            const dateStr = format(day, 'yyyy-MM-dd');
            const isFutureDay = isAfter(startOfDay(day), startOfDay(new Date()));
            const hasActivity = activityDaysInSelectedMonth.includes(dateStr);
            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => setSelectedDate(day)}
                onLayout={(event) => {
                  calendarDayPositionsRef.current[dateStr] = event.nativeEvent.layout.x;
                }}
                style={[
                  styles.calendarDay,
                  index < monthDays.length - 1 && styles.calendarDaySpaced,
                  today && styles.calendarDayToday,
                  selected && styles.calendarDaySelected,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayLabel,
                    (today || selected) && styles.calendarDayLabelToday,
                  ]}
                >
                  {format(day, 'EEE').toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.calendarDate,
                    (today || selected) && styles.calendarDateToday,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                {hasActivity && !isFutureDay && <View style={styles.calendarDot} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            {format(selectedDate, 'EEEE, MMM d')}
          </Text>
            {!isSelectedFuture && (
            <Text style={styles.welcomeSubtext}>
              {isSelectedToday
                ? isRestDay
                  ? 'Rest day — recover and grow'
                  : `${todayType} day`
                : (() => {
                    const splitDayLabel = selectedDateType === 'Rest'
                      ? 'Active Recovery day'
                      : `${getDisplayWorkoutType(profile?.program_style, selectedDateType)} day`;
                    if (sessionsForSelectedDate.length > 0) {
                      return `${sessionsForSelectedDate.length} workout${sessionsForSelectedDate.length === 1 ? '' : 's'} completed • ${splitDayLabel}`;
                    }
                    return splitDayLabel;
                  })()}
            </Text>
          )}
        </View>

        {/* Future day: only scheduled workout name, no actions */}
        {isSelectedFuture && (
          <View style={styles.workoutCard}>
            <View style={styles.workoutCardHeader}>
              <View style={styles.scheduledBadge}>
                <Text style={styles.scheduledBadgeText}>SCHEDULED</Text>
              </View>
              <View style={styles.workoutIconBox}>
                <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
              </View>
            </View>
            <Text style={styles.workoutType}>
              {selectedDateType === 'Rest' ? 'Active Recovery Day' : getDisplayWorkoutType(profile?.program_style, selectedDateType)}
            </Text>
            <Text style={styles.programName}>
              {format(selectedDate, 'MMM d, yyyy')} · Based on your program
            </Text>
          </View>
        )}

        {/* Today (non-rest): always show AI card with View Workout / Generate + Speed Log, then logged workouts below */}
        {isSelectedToday && !isRestDay && (
          <>
          <View style={styles.workoutCard}>
            <View style={styles.workoutCardHeader}>
              <View style={styles.scheduledBadge}>
                <Text style={styles.scheduledBadgeText}>SCHEDULED</Text>
              </View>
              <View style={styles.workoutIconBox}>
                <Ionicons
                  name={cachedPlan ? 'barbell' : 'sparkles'}
                  size={18}
                  color={colors.accent.primary}
                />
              </View>
            </View>

            <Text style={styles.workoutType}>
              {cachedPlan ? cachedPlan.name : 'Generate Today\'s Workout'}
            </Text>
            <View style={styles.programRow}>
              <Text style={styles.programName}>
                {programLabel ? `${programLabel} · AI Enhanced` : 'AI Optimal'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.text.tertiary}
              />
            </View>

            <Pressable
              style={styles.startButton}
              onPress={() => {
                if (cachedPlan) {
                  router.push('/workout/preview');
                } else {
                  router.push('/workout/modifications');
                }
              }}
            >
              <Ionicons
                name={cachedPlan ? 'play' : 'sparkles'}
                size={18}
                color={colors.text.inverse}
              />
              <Text style={styles.startButtonText}>
                {cachedPlan ? 'View Workout' : 'Generate Workout'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.speedLogButton}
              onPress={() => router.push({ pathname: '/speedlog', params: { logForDate: format(selectedDate, 'yyyy-MM-dd') } })}
            >
              <Ionicons
                name="flash"
                size={18}
                color={colors.text.primary}
              />
              <Text style={styles.speedLogButtonText}>Speed Log</Text>
            </Pressable>
          </View>

          {sessionsForSelectedDate.length > 0 && (
            <View style={[styles.pastSessionsContainer, { marginTop: spacing.lg }]}>
              <Text style={styles.workoutsCompletedLabel}>Workouts Completed</Text>
              {sessionsForSelectedDate.map((sess) => (
                <View key={sess.id} style={[styles.workoutCard, styles.workoutCardInList]}>
                  <View style={styles.workoutCardHeader}>
                    <View style={styles.workoutIconBox}>
                      <Ionicons name="barbell" size={18} color={colors.accent.primary} />
                    </View>
                  </View>
                  <Text style={styles.workoutType} numberOfLines={1} ellipsizeMode="tail">
                    {sess.name}
                  </Text>
                  <Text style={styles.programName}>
                    {format(selectedDate, 'MMM d, yyyy')}
                    {sess.completed_at
                      ? ` · ${format(new Date(sess.completed_at), 'h:mm a')}`
                      : ''}
                  </Text>
                  <Pressable
                    style={styles.startButton}
                    onPress={() => router.push(`/history/${sess.id}`)}
                  >
                    <Ionicons name="open-outline" size={18} color={colors.text.inverse} />
                    <Text style={styles.startButtonText}>View Workout</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
        )}

        {isSelectedToday && isRestDay && (
          <>
            {/* When a workout has been generated on Active Recovery and not yet logged, show card with View Workout (once logged, workout appears under Workouts Completed only) */}
            {cachedPlan && sessionsForSelectedDate.length === 0 && (
              <View style={styles.restDayGeneratedCardWrap}>
                <View style={styles.workoutCard}>
                  <View style={styles.workoutCardHeader}>
                    <View style={styles.scheduledBadge}>
                      <Text style={styles.scheduledBadgeText}>SCHEDULED</Text>
                    </View>
                    <View style={styles.workoutIconBox}>
                      <Ionicons name="barbell" size={18} color={colors.accent.primary} />
                    </View>
                  </View>
                  <Text style={styles.workoutType} numberOfLines={1} ellipsizeMode="tail">
                    {cachedPlan.name}
                  </Text>
                  <Text style={styles.programName}>Active Recovery · AI Enhanced</Text>
                  <Pressable
                    style={styles.startButton}
                    onPress={() => router.push('/workout/preview')}
                  >
                    <Ionicons name="play" size={18} color={colors.text.inverse} />
                    <Text style={styles.startButtonText}>View Workout</Text>
                  </Pressable>
                </View>
              </View>
            )}
            <View style={styles.restCard}>
              <Text style={styles.restEmoji}>🏃</Text>
              <Text style={styles.restTitle}>Active Recovery</Text>
              <Text style={styles.restSubtext}>
                30 min light cardio recommended — e.g. incline walk or bike. Keeps blood flowing without adding fatigue.
              </Text>
              <View style={styles.restButtonColumn}>
                <Pressable
                  style={[styles.restDayButton, styles.restDayButtonFirst]}
                  onPress={() => router.push('/workout/modifications')}
                >
                  <Ionicons name="sparkles" size={18} color={colors.text.primary} />
                  <Text style={styles.restDayButtonText}>Generate Workout</Text>
                </Pressable>
                <Pressable
                  style={styles.restDayButton}
                  onPress={() => router.push({ pathname: '/speedlog', params: { logForDate: format(selectedDate, 'yyyy-MM-dd') } })}
                >
                  <Ionicons name="flash" size={18} color={colors.text.primary} />
                  <Text style={styles.restDayButtonText}>Speed Log</Text>
                </Pressable>
              </View>
            </View>
            {sessionsForSelectedDate.length > 0 && (
              <View style={[styles.pastSessionsContainer, styles.pastSessionsContainerAfterRestCard]}>
                <Text style={styles.workoutsCompletedLabel}>Workouts Completed</Text>
                {sessionsForSelectedDate.map((sess) => (
                  <View key={sess.id} style={[styles.workoutCard, styles.workoutCardInList]}>
                    <View style={styles.workoutCardHeader}>
                      <View style={styles.workoutIconBox}>
                        <Ionicons name="barbell" size={18} color={colors.accent.primary} />
                      </View>
                    </View>
                    <Text
                      style={styles.workoutType}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {sess.name}
                    </Text>
                    <Text style={styles.programName}>
                      {format(selectedDate, 'MMM d, yyyy')}
                      {sess.completed_at
                        ? ` · ${format(new Date(sess.completed_at), 'h:mm a')}`
                        : ''}
                    </Text>
                    <Pressable
                      style={styles.startButton}
                      onPress={() => router.push(`/history/${sess.id}`)}
                    >
                      <Ionicons name="open-outline" size={18} color={colors.text.inverse} />
                      <Text style={styles.startButtonText}>View Workout</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {!isSelectedToday && !isSelectedFuture && sessionsForSelectedDate.length > 0 && (
          <View style={styles.pastSessionsContainer}>
            <Pressable
              style={styles.speedLogButtonStandalone}
              onPress={() => router.push({ pathname: '/speedlog', params: { logForDate: format(selectedDate, 'yyyy-MM-dd') } })}
            >
              <Ionicons name="flash" size={18} color={colors.text.primary} />
              <Text style={styles.speedLogButtonText}>Speed Log</Text>
            </Pressable>
            <Text style={styles.workoutsCompletedLabel}>Workouts Completed</Text>
            {sessionsForSelectedDate.map((sess) => (
              <View key={sess.id} style={[styles.workoutCard, styles.workoutCardInList]}>
                <View style={styles.workoutCardHeader}>
                  <View style={styles.workoutIconBox}>
                    <Ionicons name="barbell" size={18} color={colors.accent.primary} />
                  </View>
                </View>
                <Text
                  style={styles.workoutType}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {sess.name}
                </Text>
                <Text style={styles.programName}>
                  {format(selectedDate, 'MMM d, yyyy')}
                  {sess.completed_at
                    ? ` · ${format(new Date(sess.completed_at), 'h:mm a')}`
                    : ''}
                </Text>
                <Pressable
                  style={styles.startButton}
                  onPress={() => router.push(`/history/${sess.id}`)}
                >
                  <Ionicons name="open-outline" size={18} color={colors.text.inverse} />
                  <Text style={styles.startButtonText}>View Workout</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {!isSelectedToday && !isSelectedFuture && sessionsForSelectedDate.length === 0 && (
          <View style={styles.pastSessionsContainer}>
            <Pressable
              style={styles.speedLogButtonStandalone}
              onPress={() => router.push({ pathname: '/speedlog', params: { logForDate: format(selectedDate, 'yyyy-MM-dd') } })}
            >
              <Ionicons name="flash" size={18} color={colors.text.primary} />
              <Text style={styles.speedLogButtonText}>Speed Log</Text>
            </Pressable>
            <View style={[styles.workoutCard, styles.workoutCardInList]}>
              <View style={styles.workoutCardHeader}>
                <View style={styles.workoutIconBox}>
                  <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
                </View>
              </View>
              <Text style={styles.workoutType}>No workout logged</Text>
              <Text style={styles.programName}>
                {format(selectedDate, 'MMM d, yyyy')}
              </Text>
              <Text style={styles.noWorkoutSubtext}>
                No session was completed on this day.
              </Text>
            </View>
          </View>
        )}

        {/* Muscle Readiness — current when today, historical when past day, empty when future */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>
              MUSCLE READINESS
              {!isSelectedToday
                ? isSelectedFuture
                  ? ` · ${format(selectedDate, 'MMM d')} · Future`
                  : ` · ${format(selectedDate, 'MMM d')}`
                : ''}
            </Text>
          </View>
          <BodyMap
            fatigueMap={
              isSelectedToday
                ? fatigueMap
                : isSelectedFuture
                  ? []
                  : historicalFatigueMap
            }
            onSelectMuscle={handleSelectMuscle}
          />
        </View>

        {/* Quick Stats — only on current day */}
        {isSelectedToday && (
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
        )}

        {/* This Week's Plan — timeline visible on every day */}
        <RoutineTimeline
          programStyle={profile?.program_style}
          trainingFrequency={trainingFreq}
          activityDaysThisWeek={activityDaysThisWeek}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      <MuscleDetailSheet
        visible={sheetVisible}
        muscle={selectedMuscle}
        fatigueMap={
          isSelectedToday
            ? fatigueMap
            : isSelectedFuture
              ? []
              : historicalFatigueMap
        }
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
    maxHeight: 72,
  },
  calendarStripContent: {
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
  calendarDaySpaced: {
    marginRight: spacing.xs,
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  calendarDaySelected: {
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

  workoutsCompletedLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  pastSessionsContainer: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  pastSessionsContainerAfterRestCard: {
    marginTop: spacing.lg,
  },
  completedLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  completedLabelText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.accent.primary,
    letterSpacing: 0.3,
  },
  workoutCard: {
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  workoutCardInList: {
    marginHorizontal: 0,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    fontSize: font.lg,
    fontWeight: '700',
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
  noWorkoutSubtext: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonText: {
    color: colors.text.primary,
    fontSize: font.md,
    fontWeight: '600',
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
  speedLogButtonStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  speedLogButtonText: {
    color: colors.text.primary,
    fontSize: font.md,
    fontWeight: '600',
  },

  restDayGeneratedCardWrap: {
    marginBottom: spacing.lg,
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
  restButtonColumn: {
    width: '100%',
    marginTop: spacing.xl,
  },
  restDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  restDayButtonFirst: {
    marginTop: 0,
  },
  restDayButtonText: {
    color: colors.text.primary,
    fontSize: font.md,
    fontWeight: '600',
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
