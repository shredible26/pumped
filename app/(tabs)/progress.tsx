import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { formatWeight, formatVolume as formatVolumeWithUnit, type Units } from '@/utils/units';
import { supabase } from '@/services/supabase';
import { generateInsights, generateSuggestions, type Insight } from '@/services/insights';
import { getBig3, type Big3Result } from '@/services/strength';
import {
  calculateMuscleDistribution,
  getVolumeChartData,
  type MuscleDistributionEntry,
  type VolumeEntry,
} from '@/services/volume';
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
  const profile = useAuthStore((s) => s.profile);
  const units: Units = (profile as { units?: Units })?.units ?? 'lbs';

  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [big3, setBig3] = useState<Big3Result | null>(null);
  const [volumePeriod, setVolumePeriod] = useState<'week' | 'month' | 'year'>('week');
  const [volumeData, setVolumeData] = useState<{ entries: VolumeEntry[]; total: number }>({
    entries: [],
    total: 0,
  });
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleDistributionEntry[]>([]);
  const [distributionPeriod, setDistributionPeriod] = useState<'week' | 'month' | 'all'>('month');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const streak = profile?.current_streak_days ?? 0;

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    try {
      const [insightsRes, big3Res, distRes, volRes, suggestionsRes] = await Promise.all([
        generateInsights(userId),
        getBig3(userId),
        calculateMuscleDistribution(userId, distributionPeriod),
        getVolumeChartData(userId, volumePeriod),
        generateSuggestions(userId),
      ]);
      setInsights(insightsRes);
      setBig3(big3Res);
      setMuscleDistribution(distRes);
      setVolumeData(volRes);
      setSuggestions(suggestionsRes);

      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, is_rest_day')
        .eq('user_id', userId)
        .eq('completed', true);
      const workoutsOnly = (sessions ?? []).filter((s: any) => !s.is_rest_day);
      setTotalWorkouts(workoutsOnly.length);
    } catch (e) {
      console.warn('Progress fetch error', e);
    }
  }, [session?.user?.id, distributionPeriod, volumePeriod]);

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

  const needsMoreWorkouts = totalWorkouts < 5;
  const maxChartVol = Math.max(...volumeData.entries.map((e) => e.volume), 1);

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
              {formatVolumeWithUnit(volumeData.total, units).replace(` ${units}`, '')}
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
              { key: 'squat' as const, name: 'Squat' },
              { key: 'bench' as const, name: 'Bench Press' },
              { key: 'deadlift' as const, name: 'Deadlift' },
            ].map(({ key, name }) => {
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
                      : `Log a ${key} to track`}
                  </Text>
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyBig3}>
            <Ionicons name="trophy-outline" size={36} color={colors.text.tertiary} />
            <Text style={styles.emptyBig3Text}>
              Log bench, squat, or deadlift to see your Big 3.
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
