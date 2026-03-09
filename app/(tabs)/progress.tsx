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
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';

interface VolumeEntry {
  label: string;
  volume: number;
}

interface MuscleVolume {
  muscle: string;
  volume: number;
  percentage: number;
}

export default function ProgressScreen() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [refreshing, setRefreshing] = useState(false);
  const [totalVolume, setTotalVolume] = useState(0);
  const [volumePeriod, setVolumePeriod] = useState<'week' | 'month' | 'year'>('week');
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleVolume[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<VolumeEntry[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  const totalWorkouts = profile?.total_workouts ?? 0;
  const streak = profile?.current_streak_days ?? 0;
  const strengthScore = profile?.strength_score ?? 0;
  const squat = profile?.squat_e1rm ?? 0;
  const bench = profile?.bench_e1rm ?? 0;
  const deadlift = profile?.deadlift_e1rm ?? 0;

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    try {
      const { data: sets } = await supabase
        .from('set_logs')
        .select('exercise_name, actual_weight, actual_reps, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (sets && sets.length > 0) {
        let vol = 0;
        const muscleMap = new Map<string, number>();

        for (const s of sets) {
          const v = (s.actual_weight ?? 0) * (s.actual_reps ?? 0);
          vol += v;
          const name = (s.exercise_name ?? '').toLowerCase();
          let muscle = 'other';
          if (name.includes('bench') || name.includes('chest') || name.includes('fly')) muscle = 'Chest';
          else if (name.includes('squat') || name.includes('leg press') || name.includes('lunge')) muscle = 'Legs';
          else if (name.includes('deadlift') || name.includes('row') || name.includes('pulldown') || name.includes('pull-up')) muscle = 'Back';
          else if (name.includes('press') || name.includes('lateral') || name.includes('shoulder')) muscle = 'Shoulders';
          else if (name.includes('curl') || name.includes('tricep') || name.includes('extension')) muscle = 'Arms';
          else if (name.includes('crunch') || name.includes('plank') || name.includes('ab')) muscle = 'Core';

          if (muscle !== 'other') {
            muscleMap.set(muscle, (muscleMap.get(muscle) ?? 0) + v);
          }
        }

        setTotalVolume(vol);

        const totalMuscleVol = Array.from(muscleMap.values()).reduce((a, b) => a + b, 0);
        const dist = Array.from(muscleMap.entries())
          .map(([muscle, volume]) => ({
            muscle,
            volume,
            percentage: totalMuscleVol > 0 ? Math.round((volume / totalMuscleVol) * 100) : 0,
          }))
          .sort((a, b) => b.percentage - a.percentage);
        setMuscleDistribution(dist);

        // Generate rule-based insights
        const ins: string[] = [];
        if (totalWorkouts >= 5) {
          const pushVol = (muscleMap.get('Chest') ?? 0) + (muscleMap.get('Shoulders') ?? 0);
          const pullVol = muscleMap.get('Back') ?? 0;
          if (pushVol > 0 && pullVol > 0) {
            const ratio = pushVol / pullVol;
            if (ratio > 2) ins.push('Your push:pull volume ratio is high — consider adding more pulling exercises.');
          }
          const legVol = muscleMap.get('Legs') ?? 0;
          if (legVol === 0 && totalWorkouts > 3) {
            ins.push("You haven't trained legs recently. Don't skip leg day!");
          }
        }
        setInsights(ins);
      }
    } catch {}
  }, [session?.user?.id, totalWorkouts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const needsMoreWorkouts = totalWorkouts < 5;

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

        {/* Stats pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillStrip}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          <View style={styles.statPill}>
            <Text style={styles.statPillValue}>{totalWorkouts}</Text>
            <Text style={styles.statPillLabel}>workouts</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillValue}>{streak}</Text>
            <Text style={styles.statPillLabel}>day streak</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillValue}>
              {totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(1)}k`
                : totalVolume}
            </Text>
            <Text style={styles.statPillLabel}>lbs total</Text>
          </View>
        </ScrollView>

        {/* Insights */}
        <Text style={styles.sectionHeader}>
          <Text style={{ color: colors.accent.primary }}>Insights</Text>
        </Text>
        {needsMoreWorkouts ? (
          <View style={styles.insightCard}>
            <Ionicons name="sparkles" size={20} color={colors.accent.primary} />
            <View style={{ flex: 1 }}>
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
          insights.map((text, i) => (
            <View key={i} style={styles.insightCard}>
              <Ionicons name="bulb" size={18} color={colors.accent.primary} />
              <Text style={[styles.insightText, { flex: 1 }]}>{text}</Text>
            </View>
          ))
        ) : (
          <View style={styles.insightCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent.primary} />
            <Text style={[styles.insightText, { flex: 1 }]}>
              Looking good! No imbalances detected.
            </Text>
          </View>
        )}

        {/* Big 3 Lifts */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="trophy" size={16} color={colors.text.secondary} />
          <Text style={styles.sectionHeader}>Big 3 Lifts</Text>
        </View>

        {strengthScore > 0 ? (
          <>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>STRENGTH SCORE</Text>
              <Text style={styles.scoreNumber}>
                {strengthScore.toLocaleString()}
              </Text>
            </View>

            {[
              { name: 'Squat', value: squat },
              { name: 'Bench Press', value: bench },
              { name: 'Deadlift', value: deadlift },
            ].map((lift) => (
              <View key={lift.name} style={styles.liftCard}>
                <Text style={styles.liftName}>{lift.name}</Text>
                <Text style={styles.liftE1rm}>
                  {lift.value > 0 ? `${lift.value} lbs` : '— lbs'}
                </Text>
                <Text style={styles.liftBasis}>
                  {lift.value > 0 ? 'Estimated 1RM' : 'No data yet'}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyBig3}>
            <Ionicons name="trophy-outline" size={36} color={colors.text.tertiary} />
            <Text style={styles.emptyBig3Text}>
              Log bench, squat, or deadlift to see your Big 3.
            </Text>
          </View>
        )}

        {/* Volume */}
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
            {totalVolume >= 1000
              ? `${(totalVolume / 1000).toFixed(1)}K`
              : totalVolume}
          </Text>
          <Text style={styles.volumeUnit}>lbs</Text>
        </View>

        {/* Muscle Distribution */}
        <Text style={styles.sectionHeader}>Muscle Distribution</Text>
        {muscleDistribution.length > 0 ? (
          <View style={styles.distributionCard}>
            {muscleDistribution.map((m) => (
              <View key={m.muscle} style={styles.distRow}>
                <Text style={styles.distMuscle}>{m.muscle}</Text>
                <View style={styles.distBarBg}>
                  <View
                    style={[
                      styles.distBarFill,
                      { width: `${m.percentage}%` },
                    ]}
                  />
                </View>
                <Text style={styles.distPct}>{m.percentage}%</Text>
              </View>
            ))}
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
  statPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: colors.bg.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statPillValue: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statPillLabel: {
    fontSize: font.sm,
    color: colors.text.secondary,
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
    width: 80,
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.primary,
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
