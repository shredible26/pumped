import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { useFatigue } from '@/hooks/useFatigue';
import { generateWorkout, savePlanToCache } from '@/services/ai';
import {
  getGenerationCreditsRemaining,
  consumeGenerationCredit,
  DAILY_LIMIT,
} from '@/services/credits';
import { fetchExercises } from '@/services/exercises';
import { supabase } from '@/services/supabase';

const SUGGESTION_PILLS = [
  'Quick workout (30 min)',
  'No lower back exercises',
  'Upper body focus',
  'Light recovery day',
  'Extra volume today',
  'No barbell exercises',
];

export default function ModificationsScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const { fatigueMap, refreshFatigue } = useFatigue();
  const [modifications, setModifications] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exercises, setExercises] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    async function load() {
      await refreshFatigue();
      if (cancelled) return;
      try {
        const [exData, { data: historyData }] = await Promise.all([
          fetchExercises(),
          supabase
            .from('workout_sessions')
            .select('date, name, total_volume')
            .eq('user_id', session!.user!.id)
            .eq('completed', true)
            .gte('date', format(subDays(new Date(), 7), 'yyyy-MM-dd'))
            .order('date', { ascending: false })
            .limit(14),
        ]);
        if (!cancelled) {
          setExercises(exData);
          setRecentHistory(historyData ?? []);
        }
      } catch {
        if (!cancelled) setExercises([]);
      }
      if (!cancelled) setReady(true);
    }

    load();
    if (profile) {
      getGenerationCreditsRemaining(profile).then(setCreditsRemaining);
    }
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, refreshFatigue, profile?.id]);

  const handleGenerate = useCallback(
    async (withMods: boolean) => {
      if (!session?.user?.id || !profile) {
        Alert.alert('Error', 'Please complete your profile first.');
        return;
      }

      if (exercises.length === 0) {
        Alert.alert('Error', 'Exercise database not loaded. Try again.');
        return;
      }

      const remaining = await getGenerationCreditsRemaining(profile);
      if (remaining <= 0) {
        Alert.alert(
          'No generations left',
          `You've used all ${DAILY_LIMIT} daily generations. Try again tomorrow, or use Speed Log to manually log a workout.`,
        );
        setCreditsRemaining(0);
        return;
      }

      setGenerating(true);
      try {
        const { getBodyMapReadiness } = await import('@/services/fatigue');
        const latestReadiness = await getBodyMapReadiness(session!.user!.id, new Date());
        await refreshFatigue();
        const fatigueRecord: Record<string, any> = {};
        latestReadiness.forEach((e) => {
          fatigueRecord[e.muscle_group] = {
            recovery_pct: e.recovery_pct,
            last_trained_at: e.last_trained_at,
            last_strain_score: e.last_strain_score ?? undefined,
          };
        });

        const plan = await generateWorkout({
          profile: {
            program_style: profile.program_style,
            experience_level: profile.experience_level,
            equipment_access: profile.equipment_access,
            training_frequency: profile.training_frequency,
            weight_lbs: profile.weight_lbs,
            gender: profile.gender ?? undefined,
          },
          fatigueMap: fatigueRecord,
          recentHistory,
          exercises: exercises.map((e) => ({
            id: e.id,
            name: e.name,
            primary_muscle: e.primary_muscle,
            equipment: e.equipment,
            difficulty: e.difficulty,
          })),
          modifications: withMods ? modifications.trim() : undefined,
          planDayOfWeek: new Date().getDay(),
        });

        await savePlanToCache(session.user.id, plan);
        await consumeGenerationCredit(session.user.id, remaining);
        const nextCredits = Math.max(0, remaining - 1);
        setCreditsRemaining(nextCredits);
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (updatedProfile) setProfile(updatedProfile as any);
        router.replace('/workout/preview');
      } catch (err: any) {
        const msg = err?.message ?? '';
        const isNetwork = /network|fetch|internet|timeout/i.test(msg);
        Alert.alert(
          isNetwork ? 'No internet' : 'Workout generation failed',
          isNetwork
            ? 'You need internet to generate a workout. Use Speed Log for offline logging.'
            : msg || 'Please try again or use Speed Log.'
        );
      } finally {
        setGenerating(false);
      }
    },
    [
      session?.user?.id,
      profile,
      setProfile,
      fatigueMap,
      recentHistory,
      exercises,
      modifications,
      router,
    ]
  );

  const addSuggestion = (text: string) => {
    setModifications((prev) => (prev ? `${prev}. ${text}` : text));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Customize Workout</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>&lt; Back</Text>
          </Pressable>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={24} color={colors.accent.primary} />
              <Text style={styles.cardTitle}>Any modifications for today?</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Describe any adjustments and AI will adapt your workout.
            </Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="e.g. No exercises that strain my wrist, keep it under 30 minutes, focus on shoulders..."
                placeholderTextColor={colors.text.tertiary}
                value={modifications}
                onChangeText={setModifications}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!generating}
              />
            </View>

            <View style={styles.pillsRow}>
              {SUGGESTION_PILLS.map((label) => (
                <Pressable
                  key={label}
                  style={styles.pill}
                  onPress={() => addSuggestion(label)}
                  disabled={generating}
                >
                  <Text style={styles.pillText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {generating ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={colors.accent.primary} />
              <Text style={styles.loadingText}>Generating your workout...</Text>
            </View>
          ) : (
            <>
              {creditsRemaining !== null ? (
                <Text style={styles.creditsLine}>
                  {creditsRemaining === 0
                    ? 'No generations remaining today'
                    : `${creditsRemaining} of ${DAILY_LIMIT} generations remaining today`}
                </Text>
              ) : null}
              <Pressable
                style={styles.generateButton}
                onPress={() => handleGenerate(true)}
                disabled={!ready}
              >
                <Ionicons name="sparkles" size={20} color={colors.text.inverse} />
                <Text style={styles.generateButtonText}>Generate Workout</Text>
              </Pressable>

              <Pressable
                style={styles.generateWithoutButton}
                onPress={() => handleGenerate(false)}
                disabled={!ready}
              >
                <Text style={styles.generateWithoutText}>
                  Generate without modifications
                </Text>
              </Pressable>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  backLink: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.accent.primary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  inputWrap: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 100,
    marginBottom: spacing.md,
  },
  input: {
    padding: spacing.lg,
    fontSize: font.md,
    color: colors.text.primary,
    minHeight: 100,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pillText: {
    fontSize: font.sm,
    color: colors.text.secondary,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: font.md,
    color: colors.text.secondary,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  generateButtonText: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  generateWithoutButton: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
  },
  creditsLine: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  generateWithoutText: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
