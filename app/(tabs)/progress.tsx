import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { formatWeight, formatVolume as formatVolumeWithUnit, type Units } from '@/utils/units';
import {
  generateSuggestions,
  getProgressNarratives,
  type Insight,
} from '@/services/insights';
import { getBig3, type Big3Result } from '@/services/strength';
import {
  calculateMuscleDistribution,
  getVolumeChartData,
  type MuscleDistributionEntry,
  type VolumeEntry,
} from '@/services/volume';
import { fetchDashboardStats } from '@/services/dashboardStats';
import StrengthTrendChart from '@/components/progress/StrengthTrendChart';
import {
  getStrengthTrendData,
  getStrengthTrendExerciseOptions,
  type StrengthTrendData,
  type StrengthTrendExerciseOption,
} from '@/services/strengthTrends';
import { supabase } from '@/services/supabase';
import { useFocusEffect } from 'expo-router';

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  lats: 'Lats',
  traps: 'Traps',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

export default function ProgressScreen() {
  const session = useAuthStore((s) => s.session);
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const units: Units = (profile as { units?: Units })?.units ?? 'lbs';

  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [big3, setBig3] = useState<Big3Result | null>(null);
  const [strengthTrendOptions, setStrengthTrendOptions] = useState<StrengthTrendExerciseOption[]>([]);
  const [selectedStrengthTrendExerciseId, setSelectedStrengthTrendExerciseId] = useState<string | null>(null);
  const [strengthTrendData, setStrengthTrendData] = useState<StrengthTrendData | null>(null);
  const [strengthTrendLoading, setStrengthTrendLoading] = useState(false);
  const [strengthTrendPickerOpen, setStrengthTrendPickerOpen] = useState(false);
  const [strengthTrendSearchQuery, setStrengthTrendSearchQuery] = useState('');
  const [volumePeriod, setVolumePeriod] = useState<'week' | 'month' | 'year'>('week');
  const [volumeData, setVolumeData] = useState<{ entries: VolumeEntry[]; total: number }>({
    entries: [],
    total: 0,
  });
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleDistributionEntry[]>([]);
  const [distributionPeriod, setDistributionPeriod] = useState<'week' | 'month' | 'all'>('month');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsRefreshing, setSuggestionsRefreshing] = useState(false);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [weeklyVolumeTotal, setWeeklyVolumeTotal] = useState(0);
  const streak = profile?.current_streak_days ?? 0;
  const selectedStrengthTrendExerciseIdRef = useRef<string | null>(null);
  const fetchDataRef = useRef<
    ((options?: { preserveStrengthSelection?: boolean }) => Promise<void>) | null
  >(null);
  const hasLoadedProgressRef = useRef(false);
  const hasHydratedFilterFetchRef = useRef(false);
  const autoRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStrengthTrendData = useCallback(async (userId: string, exerciseId: string | null) => {
    if (!exerciseId) {
      setStrengthTrendData(null);
      setStrengthTrendLoading(false);
      return;
    }

    setStrengthTrendLoading(true);
    try {
      const data = await getStrengthTrendData(userId, exerciseId);
      setStrengthTrendData(data);
    } catch (error) {
      console.warn('Strength trend fetch error', error);
      setStrengthTrendData(null);
    } finally {
      setStrengthTrendLoading(false);
    }
  }, []);

  const resetStrengthTrendSelection = useCallback(() => {
    selectedStrengthTrendExerciseIdRef.current = null;
    setSelectedStrengthTrendExerciseId(null);
    setStrengthTrendData(null);
    setStrengthTrendPickerOpen(false);
    setStrengthTrendSearchQuery('');
  }, []);

  const fetchData = useCallback(async (options?: { preserveStrengthSelection?: boolean }) => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const preserveStrengthSelection = options?.preserveStrengthSelection ?? true;

    if (!preserveStrengthSelection) {
      selectedStrengthTrendExerciseIdRef.current = null;
      setSelectedStrengthTrendExerciseId(null);
      setStrengthTrendData(null);
    }

    setStrengthTrendLoading(true);
    try {
      const [
        narrativesRes,
        big3Res,
        distRes,
        volRes,
        strengthTrendOptionsRes,
        dashboardStatsRes,
      ] = await Promise.all([
        getProgressNarratives(userId),
        getBig3(userId),
        calculateMuscleDistribution(userId, distributionPeriod),
        getVolumeChartData(userId, volumePeriod),
        getStrengthTrendExerciseOptions(userId),
        fetchDashboardStats(userId),
      ]);
      setInsights(narrativesRes.insights);
      setBig3(big3Res);
      setMuscleDistribution(distRes);
      setVolumeData(volRes);
      setSuggestions(narrativesRes.suggestions);
      setStrengthTrendOptions(strengthTrendOptionsRes);
      setTotalWorkouts(dashboardStatsRes.workoutCount);
      setWeeklyVolumeTotal(dashboardStatsRes.weeklyVolumeTotal);

      const resolvedStrengthTrendExerciseId =
        preserveStrengthSelection &&
        selectedStrengthTrendExerciseIdRef.current &&
        strengthTrendOptionsRes.some(
          (option) => option.exerciseId === selectedStrengthTrendExerciseIdRef.current,
        )
          ? selectedStrengthTrendExerciseIdRef.current
          : null;

      selectedStrengthTrendExerciseIdRef.current = resolvedStrengthTrendExerciseId;
      setSelectedStrengthTrendExerciseId(resolvedStrengthTrendExerciseId);
      if (resolvedStrengthTrendExerciseId) {
        await loadStrengthTrendData(userId, resolvedStrengthTrendExerciseId);
      } else {
        setStrengthTrendData(null);
        setStrengthTrendLoading(false);
      }
    } catch (e) {
      console.warn('Progress fetch error', e);
      setStrengthTrendLoading(false);
    }
  }, [session?.user?.id, distributionPeriod, volumePeriod, loadStrengthTrendData]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    hasLoadedProgressRef.current = false;
    hasHydratedFilterFetchRef.current = false;
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id) return;

      if (!hasLoadedProgressRef.current) {
        resetStrengthTrendSelection();
        hasLoadedProgressRef.current = true;
        void fetchDataRef.current?.({ preserveStrengthSelection: false });
        return;
      }

      void fetchDataRef.current?.({ preserveStrengthSelection: true });
    }, [session?.user?.id, resetStrengthTrendSelection]),
  );

  useEffect(() => {
    if (!hasLoadedProgressRef.current || !session?.user?.id) return;
    if (!hasHydratedFilterFetchRef.current) {
      hasHydratedFilterFetchRef.current = true;
      return;
    }
    void fetchData({ preserveStrengthSelection: true });
  }, [distributionPeriod, volumePeriod, session?.user?.id, fetchData]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const scheduleRefresh = () => {
      if (!hasLoadedProgressRef.current) return;
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
      autoRefreshTimeoutRef.current = setTimeout(() => {
        void fetchDataRef.current?.({ preserveStrengthSelection: true });
      }, 250);
    };

    const channel = supabase
      .channel(`progress-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_sessions',
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'muscle_strain_log',
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
        autoRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData({ preserveStrengthSelection: true });
    setRefreshing(false);
  }, [fetchData]);

  const needsMoreWorkouts = totalWorkouts < 5;
  const maxChartVol = Math.max(...volumeData.entries.map((e) => e.volume), 1);
  const selectedStrengthTrendExercise = useMemo(
    () =>
      strengthTrendOptions.find(
        (option) => option.exerciseId === selectedStrengthTrendExerciseId,
      ) ?? null,
    [strengthTrendOptions, selectedStrengthTrendExerciseId],
  );
  const filteredStrengthTrendOptions = useMemo(() => {
    const query = strengthTrendSearchQuery.trim().toLowerCase();
    if (!query) return strengthTrendOptions;

    return strengthTrendOptions.filter((option) =>
      option.exerciseName.toLowerCase().includes(query),
    );
  }, [strengthTrendOptions, strengthTrendSearchQuery]);

  const handleSelectStrengthTrendExercise = useCallback(
    (exerciseId: string) => {
      if (!session?.user?.id) return;
      selectedStrengthTrendExerciseIdRef.current = exerciseId;
      setSelectedStrengthTrendExerciseId(exerciseId);
      setStrengthTrendPickerOpen(false);
      setStrengthTrendSearchQuery('');
      void loadStrengthTrendData(session.user.id, exerciseId);
    },
    [session?.user?.id, loadStrengthTrendData],
  );

  const closeStrengthTrendPicker = useCallback(() => {
    setStrengthTrendPickerOpen(false);
    setStrengthTrendSearchQuery('');
  }, []);

  const handleRegenerateSuggestions = useCallback(async () => {
    if (!session?.user?.id || needsMoreWorkouts || suggestionsRefreshing) return;

    setSuggestionsRefreshing(true);
    try {
      let nextSuggestions = await generateSuggestions(session.user.id, {
        excludeSuggestions: suggestions,
        variationSeed: Date.now(),
      });

      if (nextSuggestions.join('||') === suggestions.join('||')) {
        nextSuggestions = await generateSuggestions(session.user.id, {
          variationSeed: Date.now() + 1,
        });
      }

      setSuggestions(nextSuggestions);
    } catch (error) {
      console.warn('Suggestions refresh error', error);
    } finally {
      setSuggestionsRefreshing(false);
    }
  }, [
    needsMoreWorkouts,
    session?.user?.id,
    suggestions,
    suggestionsRefreshing,
  ]);

  const insightIconColor = (type: Insight['type']) => {
    if (type === 'positive') return colors.accent.primary;
    if (type === 'warning') return '#F97316';
    return '#3B82F6';
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
        <Text style={styles.title}>Progress</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{streak > 0 ? `🔥 ${streak}` : '0'}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {formatVolumeWithUnit(weeklyVolumeTotal, units).replace(` ${units}`, '')}
            </Text>
            <Text style={styles.statLabel}>
              {units === 'lbs' ? 'Lbs total' : 'Kg total'}
            </Text>
          </View>
        </View>

        {/* Insights */}
        <Text style={styles.sectionHeader}>
          <Text style={{ color: colors.accent.primary }}>Insights</Text>
        </Text>
        {needsMoreWorkouts ? (
          <View style={styles.insightCard}>
            <Ionicons name="sparkles" size={20} color={colors.accent.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>Unlock insights</Text>
              <Text style={styles.insightText}>
                Log {5 - totalWorkouts} more workout
                {5 - totalWorkouts !== 1 ? 's' : ''} to unlock insights
              </Text>
              <View style={styles.insightBar}>
                <View
                  style={[
                    styles.insightBarFill,
                    { width: `${(totalWorkouts / 5) * 100}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        ) : insights.length > 0 ? (
          insights.map((insight, i) => (
            <View key={i} style={styles.insightCard}>
              <View
                style={[
                  styles.insightIconWrap,
                  { backgroundColor: `${insightIconColor(insight.type)}20` },
                ]}
              >
                <Text style={styles.insightEmoji}>{insight.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightText}>{insight.description}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.insightCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>Looking good</Text>
              <Text style={styles.insightText}>No imbalances detected. Keep it up!</Text>
            </View>
          </View>
        )}

        {/* Suggestions — numeric bullet list */}
        {!needsMoreWorkouts && suggestions.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Suggestions</Text>
            <View style={styles.suggestionsCard}>
              {suggestions.map((line, idx) => (
                <Text key={idx} style={styles.suggestionItem}>
                  {idx + 1}. {line}
                </Text>
              ))}
            </View>
            <Pressable
              style={[
                styles.suggestionsRegenerateButton,
                suggestionsRefreshing && styles.suggestionsRegenerateButtonDisabled,
              ]}
              onPress={() => void handleRegenerateSuggestions()}
              disabled={suggestionsRefreshing}
            >
              {suggestionsRefreshing ? (
                <ActivityIndicator size="small" color={colors.accent.primary} />
              ) : (
                <Ionicons name="refresh" size={16} color={colors.accent.primary} />
              )}
              <Text style={styles.suggestionsRegenerateButtonText}>Regenerate</Text>
            </Pressable>
          </>
        )}

        {/* Big 3 */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="trophy" size={16} color={colors.text.secondary} />
          <Text style={styles.sectionHeader}>Big 3 Lifts</Text>
        </View>

        {big3 && big3.total > 0 ? (
          <>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>STRENGTH SCORE</Text>
              <Text style={styles.scoreNumber}>{Math.round(big3.total).toLocaleString()}</Text>
            </View>
            {[
              {
                key: 'squat' as const,
                name: 'Barbell Squat',
                trackPrompt: 'barbell squat',
              },
              {
                key: 'bench' as const,
                name: 'Barbell Bench Press',
                trackPrompt: 'barbell bench press',
              },
              {
                key: 'deadlift' as const,
                name: 'Deadlift',
                trackPrompt: 'deadlift',
              },
            ].map(({ key, name, trackPrompt }) => {
              const entry = big3[key];
              return (
                <View key={key} style={styles.liftCard}>
                  <Text style={styles.liftName}>{name}</Text>
                  <Text style={styles.liftE1rm}>
                    {entry ? formatWeight(entry.value, units) : '—'}
                  </Text>
                  <Text style={styles.liftBasis}>
                    {entry
                      ? entry.date
                        ? `${entry.source} on ${entry.date}`
                        : entry.source
                      : `Log a ${trackPrompt} to track`}
                  </Text>
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyBig3}>
            <Ionicons name="trophy-outline" size={36} color={colors.text.tertiary} />
            <Text style={styles.emptyBig3Text}>
              Log a barbell squat, barbell bench press, or deadlift to see your Big 3.
            </Text>
          </View>
        )}

        {/* Strength Trends */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="trending-up" size={16} color={colors.text.secondary} />
          <Text style={styles.sectionHeader}>Strength Trends</Text>
        </View>

        {strengthTrendLoading && strengthTrendOptions.length === 0 ? (
          <View style={styles.strengthTrendLoadingCard}>
            <ActivityIndicator color={colors.accent.primary} />
            <Text style={styles.strengthTrendLoadingText}>
              Loading weighted exercises...
            </Text>
          </View>
        ) : strengthTrendOptions.length > 0 ? (
          <>
            {selectedStrengthTrendExercise ? (
              <Pressable
                style={styles.strengthTrendSelector}
                onPress={() => setStrengthTrendPickerOpen(true)}
              >
                <View style={styles.strengthTrendSelectorCopy}>
                  <Text style={styles.strengthTrendSelectorLabel}>Selected exercise</Text>
                  <Text style={styles.strengthTrendSelectorValue}>
                    {selectedStrengthTrendExercise.exerciseName}
                  </Text>
                  <Text style={styles.strengthTrendSelectorMeta}>
                    {`${selectedStrengthTrendExercise.sessionCount} workout${
                      selectedStrengthTrendExercise.sessionCount === 1 ? '' : 's'
                    } tracked${
                      selectedStrengthTrendExercise.lastLoggedDate
                        ? ` · Last logged ${format(
                            new Date(`${selectedStrengthTrendExercise.lastLoggedDate}T12:00:00`),
                            'MMM d',
                          )}`
                        : ''
                    }`}
                  </Text>
                </View>
                <View style={styles.strengthTrendSelectorIcon}>
                  <Ionicons name="chevron-down" size={18} color={colors.text.primary} />
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={styles.strengthTrendPromptCard}
                onPress={() => setStrengthTrendPickerOpen(true)}
              >
                <View style={styles.strengthTrendPromptIconWrap}>
                  <Ionicons name="barbell-outline" size={26} color={colors.accent.primary} />
                </View>
                <Text style={styles.strengthTrendPromptTitle}>Choose an exercise</Text>
                <Text style={styles.strengthTrendPromptText}>
                  Pick a weighted exercise from your past workouts to generate a trend line,
                  actual max, and estimated 1RM.
                </Text>
                <View style={styles.strengthTrendPromptButton}>
                  <Text style={styles.strengthTrendPromptButtonText}>Choose Exercise</Text>
                </View>
              </Pressable>
            )}

            {selectedStrengthTrendExercise && strengthTrendLoading ? (
              <View style={styles.strengthTrendLoadingCard}>
                <ActivityIndicator color={colors.accent.primary} />
                <Text style={styles.strengthTrendLoadingText}>
                  Building your trend line...
                </Text>
              </View>
            ) : selectedStrengthTrendExercise && strengthTrendData && strengthTrendData.points.length > 0 ? (
              <>
                <StrengthTrendChart
                  exerciseName={strengthTrendData.exerciseName}
                  points={strengthTrendData.points}
                  actualMax={strengthTrendData.actualMax}
                  peerComparison={strengthTrendData.peerComparison}
                  units={units}
                />

                <View style={styles.strengthTrendMetricGrid}>
                  <View style={styles.strengthTrendMetricCard}>
                    <Text style={styles.strengthTrendMetricLabel}>Actual max</Text>
                    <Text style={styles.strengthTrendMetricValue}>
                      {strengthTrendData.actualMax
                        ? formatWeight(strengthTrendData.actualMax.value, units)
                        : '—'}
                    </Text>
                    <Text style={styles.strengthTrendMetricSubtext}>
                      {strengthTrendData.actualMax?.reps
                        ? `${formatWeight(
                            strengthTrendData.actualMax.weight,
                            units,
                          )} x ${strengthTrendData.actualMax.reps}`
                        : 'No top set recorded yet'}
                    </Text>
                    <Text style={styles.strengthTrendMetricCaption}>
                      {strengthTrendData.actualMax
                        ? `${strengthTrendData.actualMax.sessionName} · ${format(
                            new Date(`${strengthTrendData.actualMax.sessionDate}T12:00:00`),
                            'MMM d, yyyy',
                          )}`
                        : 'Tracked from completed workouts'}
                    </Text>
                  </View>

                  <View style={styles.strengthTrendMetricCard}>
                    <Text style={styles.strengthTrendMetricLabel}>Estimated 1RM</Text>
                    <Text style={styles.strengthTrendMetricValue}>
                      {strengthTrendData.estimatedOneRepMax
                        ? formatWeight(strengthTrendData.estimatedOneRepMax.value, units)
                        : '—'}
                    </Text>
                    <Text style={styles.strengthTrendMetricSubtext}>
                      {strengthTrendData.estimatedOneRepMax?.reps
                        ? `Based on ${formatWeight(
                            strengthTrendData.estimatedOneRepMax.weight,
                            units,
                          )} x ${strengthTrendData.estimatedOneRepMax.reps}`
                        : 'Needs a logged weight and rep count'}
                    </Text>
                    <Text style={styles.strengthTrendMetricCaption}>
                      {strengthTrendData.estimatedOneRepMax
                        ? `${strengthTrendData.estimatedOneRepMax.sessionName} · ${format(
                            new Date(
                              `${strengthTrendData.estimatedOneRepMax.sessionDate}T12:00:00`,
                            ),
                            'MMM d, yyyy',
                          )}`
                        : 'We will calculate this as more sets are logged'}
                    </Text>
                  </View>
                </View>
              </>
            ) : selectedStrengthTrendExercise ? (
              <View style={styles.strengthTrendEmptyCard}>
                <Ionicons name="analytics-outline" size={34} color={colors.text.tertiary} />
                <Text style={styles.strengthTrendEmptyTitle}>
                  No weighted sets recorded yet
                </Text>
                <Text style={styles.strengthTrendEmptyText}>
                  Log a weighted set for this exercise to unlock a trend line, actual max,
                  and estimated 1RM.
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.strengthTrendEmptyCard}>
            <Ionicons name="barbell-outline" size={34} color={colors.text.tertiary} />
            <Text style={styles.strengthTrendEmptyTitle}>
              Strength Trends unlock with weighted lifts
            </Text>
            <Text style={styles.strengthTrendEmptyText}>
              Barbell, dumbbell, machine, cable, and kettlebell exercises will appear here
              after you log them. Cardio and bodyweight movements are excluded.
            </Text>
          </View>
        )}

        {/* Volume chart */}
        <Text style={styles.sectionHeader}>Volume</Text>
        <View style={styles.volumeToggle}>
          {(['week', 'month', 'year'] as const).map((p) => (
            <Pressable
              key={p}
              style={[
                styles.volumeToggleBtn,
                volumePeriod === p && styles.volumeToggleBtnActive,
              ]}
              onPress={() => setVolumePeriod(p)}
            >
              <Text
                style={[
                  styles.volumeToggleText,
                  volumePeriod === p && styles.volumeToggleTextActive,
                ]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.volumeCard}>
          <Text style={styles.volumeNumber}>
            {formatVolumeWithUnit(volumeData.total, units).replace(` ${units}`, '')}
          </Text>
          <Text style={styles.volumeUnit}>{units}</Text>
        </View>
        {volumeData.entries.length > 0 && (
          <View style={styles.chartRow}>
            {volumeData.entries.map((e, i) => (
              <Pressable
                key={i}
                style={styles.chartBarWrap}
                onPress={() =>
                  Alert.alert(
                    e.label,
                    `Volume: ${formatVolumeWithUnit(e.volume, units)}`
                  )
                }
              >
                <View style={styles.chartBarBg}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        height: `${Math.max(8, (e.volume / maxChartVol) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Muscle Distribution */}
        <Text style={styles.sectionHeader}>Muscle Distribution</Text>
        <View style={styles.distToggle}>
          <Pressable
            style={[
              styles.distToggleBtn,
              distributionPeriod === 'week' && styles.distToggleBtnActive,
            ]}
            onPress={() => setDistributionPeriod('week')}
          >
            <Text
              style={[
                styles.distToggleText,
                distributionPeriod === 'week' && styles.distToggleTextActive,
              ]}
            >
              This week
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.distToggleBtn,
              distributionPeriod === 'month' && styles.distToggleBtnActive,
            ]}
            onPress={() => setDistributionPeriod('month')}
          >
            <Text
              style={[
                styles.distToggleText,
                distributionPeriod === 'month' && styles.distToggleTextActive,
              ]}
            >
              This month
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.distToggleBtn,
              distributionPeriod === 'all' && styles.distToggleBtnActive,
            ]}
            onPress={() => setDistributionPeriod('all')}
          >
            <Text
              style={[
                styles.distToggleText,
                distributionPeriod === 'all' && styles.distToggleTextActive,
              ]}
            >
              All time
            </Text>
          </Pressable>
        </View>
        {muscleDistribution.length > 0 ? (
          <View style={styles.distributionCard}>
            {muscleDistribution.map((m, idx) => {
              const label = MUSCLE_LABELS[m.muscle] ?? m.muscle;
              const isBottom = idx >= muscleDistribution.length - 3;
              return (
                <View key={m.muscle} style={styles.distRow}>
                  <View style={{ width: 88 }}>
                    <Text
                      style={[
                        styles.distMuscle,
                        isBottom && styles.distMuscleWarning,
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    {isBottom && (
                      <Text style={styles.distHint}>Consider adding more {label.toLowerCase()} work</Text>
                    )}
                  </View>
                  <View style={styles.distBarBg}>
                    <View
                      style={[
                        styles.distBarFill,
                        { width: `${Math.min(100, m.percentage)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.distPct}>{m.percentage}%</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Complete workouts to see your muscle distribution.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={strengthTrendPickerOpen}
        animationType="slide"
        onRequestClose={closeStrengthTrendPicker}
      >
        <View style={styles.strengthTrendPickerScreen}>
          <View
            style={[
              styles.strengthTrendPickerHeader,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <View style={styles.strengthTrendPickerHeaderSpacer} />
            <Text style={styles.strengthTrendPickerTitle}>Choose an exercise</Text>
            <View style={styles.strengthTrendPickerHeaderSpacer} />
          </View>

          <KeyboardAvoidingView
            style={styles.strengthTrendPickerBody}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.strengthTrendPickerIntro}>
              <Text style={styles.strengthTrendPickerIntroTitle}>Logged weighted exercises</Text>
              <Text style={styles.strengthTrendPickerIntroText}>
                Only barbell, dumbbell, cable, machine, and kettlebell lifts from your
                completed workouts appear here.
              </Text>
            </View>

            <ScrollView
              style={styles.strengthTrendPickerList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.strengthTrendPickerListContent}
            >
              {filteredStrengthTrendOptions.length > 0 ? (
                filteredStrengthTrendOptions.map((option) => {
                  const isSelected = option.exerciseId === selectedStrengthTrendExerciseId;
                  return (
                    <Pressable
                      key={option.exerciseId}
                      style={[
                        styles.strengthTrendOptionRow,
                        isSelected && styles.strengthTrendOptionRowSelected,
                      ]}
                      onPress={() => handleSelectStrengthTrendExercise(option.exerciseId)}
                    >
                      <View style={styles.strengthTrendOptionCopy}>
                        <Text
                          style={[
                            styles.strengthTrendOptionName,
                            isSelected && styles.strengthTrendOptionNameSelected,
                          ]}
                        >
                          {option.exerciseName}
                        </Text>
                        <Text style={styles.strengthTrendOptionMeta}>
                          {option.sessionCount} workout
                          {option.sessionCount === 1 ? '' : 's'}
                          {option.lastLoggedDate
                            ? ` · ${format(
                                new Date(`${option.lastLoggedDate}T12:00:00`),
                                'MMM d, yyyy',
                              )}`
                            : ''}
                        </Text>
                        {option.lastWorkoutName ? (
                          <Text style={styles.strengthTrendOptionWorkoutName}>
                            {option.lastWorkoutName}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.strengthTrendOptionRight}>
                        {option.latestWeight ? (
                          <Text style={styles.strengthTrendOptionWeight}>
                            {formatWeight(option.latestWeight, units)}
                          </Text>
                        ) : null}
                        {isSelected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={colors.accent.primary}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.strengthTrendModalEmpty}>
                  <Ionicons name="search-outline" size={26} color={colors.text.tertiary} />
                  <Text style={styles.strengthTrendModalEmptyText}>
                    No exercises match that search.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View
              style={[
                styles.strengthTrendPickerFooter,
                { paddingBottom: Math.max(insets.bottom, 24) },
              ]}
            >
              <Pressable
                style={styles.strengthTrendPickerBackButton}
                onPress={closeStrengthTrendPicker}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
                <Text style={styles.strengthTrendPickerBackText}>Back</Text>
              </Pressable>
              <View style={styles.strengthTrendPickerSearchDock}>
                <Ionicons name="search" size={18} color={colors.text.tertiary} />
                <TextInput
                  style={styles.strengthTrendPickerSearchInput}
                  value={strengthTrendSearchQuery}
                  onChangeText={setStrengthTrendSearchQuery}
                  placeholder="Search exercises..."
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {strengthTrendSearchQuery.length > 0 ? (
                  <Pressable onPress={() => setStrengthTrendSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  pillStrip: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
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
  sectionHeader: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  insightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightEmoji: {
    fontSize: 18,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  insightText: {
    fontSize: font.md,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  insightBar: {
    height: 4,
    backgroundColor: colors.bg.input,
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  insightBarFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 2,
  },
  suggestionsCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  suggestionItem: {
    fontSize: font.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  suggestionsRegenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.bg,
    marginBottom: spacing.sm,
  },
  suggestionsRegenerateButtonDisabled: {
    opacity: 0.7,
  },
  suggestionsRegenerateButtonText: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.accent.primary,
  },

  scoreCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scoreLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1,
  },
  scoreNumber: {
    fontSize: font.display,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  liftCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  liftName: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  liftE1rm: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  liftBasis: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  emptyBig3: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyBig3Text: {
    fontSize: font.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  strengthTrendSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  strengthTrendSelectorCopy: {
    flex: 1,
  },
  strengthTrendSelectorLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  strengthTrendSelectorValue: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 4,
  },
  strengthTrendSelectorMeta: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  strengthTrendSelectorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthTrendPromptCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  strengthTrendPromptIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  strengthTrendPromptTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  strengthTrendPromptText: {
    fontSize: font.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  strengthTrendPromptButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  strengthTrendPromptButtonText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  strengthTrendLoadingCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  strengthTrendLoadingText: {
    fontSize: font.md,
    color: colors.text.secondary,
  },
  strengthTrendMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  strengthTrendMetricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
  },
  strengthTrendMetricLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  strengthTrendMetricValue: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  strengthTrendMetricSubtext: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  strengthTrendMetricCaption: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  strengthTrendEmptyCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  strengthTrendEmptyTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  strengthTrendEmptyText: {
    fontSize: font.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  strengthTrendPickerScreen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  strengthTrendPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  strengthTrendPickerHeaderSpacer: {
    width: 64,
  },
  strengthTrendPickerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  strengthTrendPickerBody: {
    flex: 1,
  },
  strengthTrendPickerIntro: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  strengthTrendPickerIntroTitle: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.primary,
  },
  strengthTrendPickerIntroText: {
    fontSize: font.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  strengthTrendPickerList: {
    flex: 1,
    marginTop: spacing.lg,
  },
  strengthTrendPickerListContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  strengthTrendOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  strengthTrendOptionRowSelected: {
    backgroundColor: colors.accent.bg,
    borderColor: colors.accent.primary,
  },
  strengthTrendOptionCopy: {
    flex: 1,
  },
  strengthTrendOptionName: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text.primary,
  },
  strengthTrendOptionNameSelected: {
    color: colors.accent.primary,
  },
  strengthTrendOptionMeta: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  strengthTrendOptionWorkoutName: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  strengthTrendOptionRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  strengthTrendOptionWeight: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  strengthTrendModalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
  strengthTrendModalEmptyText: {
    fontSize: font.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  strengthTrendPickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.primary,
  },
  strengthTrendPickerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
  },
  strengthTrendPickerBackText: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  strengthTrendPickerSearchDock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
  },
  strengthTrendPickerSearchInput: {
    flex: 1,
    fontSize: font.md,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },

  volumeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  volumeToggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  volumeToggleBtnActive: {
    backgroundColor: colors.bg.input,
  },
  volumeToggleText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  volumeToggleTextActive: {
    color: colors.text.primary,
  },
  volumeCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  volumeNumber: {
    fontSize: font.display,
    fontWeight: '800',
    color: colors.text.primary,
  },
  volumeUnit: {
    fontSize: font.lg,
    color: colors.text.secondary,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    marginTop: spacing.sm,
    paddingHorizontal: 4,
  },
  chartBarWrap: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarBg: {
    width: '80%',
    flex: 1,
    backgroundColor: colors.bg.input,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 4,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 4,
  },

  distToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  distToggleBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  distToggleBtnActive: {
    backgroundColor: colors.accent.bg,
    borderColor: colors.accent.primary,
  },
  distToggleText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  distToggleTextActive: {
    color: colors.accent.primary,
  },
  distributionCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.md,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  distMuscle: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  distMuscleWarning: {
    color: '#F97316',
  },
  distHint: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  distBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bg.input,
    borderRadius: 4,
    overflow: 'hidden',
  },
  distBarFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 4,
  },
  distPct: {
    width: 36,
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: colors.bg.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: font.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
