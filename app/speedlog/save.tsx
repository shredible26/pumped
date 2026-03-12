import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';

export default function SpeedLogSaveScreen() {
  const router = useRouter();
  const { type, workoutName: paramWorkoutName, exerciseNames, exerciseSets } = useLocalSearchParams<{
    type: string;
    workoutName?: string;
    exerciseNames: string;
    exerciseSets: string;
  }>();
  const session = useAuthStore((s) => s.session);

  const names = exerciseNames?.split('|') ?? [];
  const sets = exerciseSets?.split('|') ?? [];
  const workoutName = paramWorkoutName ?? `My ${type} Day`;
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const exercisesJson = names.map((name, i) => ({
        name,
        sets: parseInt(sets[i], 10) || 3,
      }));

      await supabase.from('saved_workouts').insert({
        user_id: session.user.id,
        name: workoutName,
        workout_type: type?.toLowerCase() ?? null,
        exercises: exercisesJson,
        last_used_at: new Date().toISOString(),
        use_count: 1,
      });
    } catch {}
    setSaving(false);
    goBackToToday();
  };

  const handleSkip = () => {
    goBackToToday();
  };

  /** Dismiss the whole speedlog modal stack (save → editor → index) so we land on Today without duplicating it. */
  function goBackToToday() {
    router.dismiss();
    setTimeout(() => router.dismiss(), 50);
    setTimeout(() => router.dismiss(), 120);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="bookmark" size={28} color={colors.accent.primary} />
        </View>

        <Text style={styles.title}>Save This Workout?</Text>
        <Text style={styles.subtitle}>
          Reuse it next time you train {type}
        </Text>
        <Text style={styles.workoutNameDisplay}>{workoutName}</Text>

        <View style={styles.exerciseList}>
          {names.map((name, i) => (
            <View key={i} style={styles.exerciseRow}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.accent.primary}
              />
              <Text style={styles.exerciseName}>{name}</Text>
              <Text style={styles.exerciseSets}>{sets[i]} sets</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="bookmark" size={18} color={colors.text.inverse} />
          <Text style={styles.saveButtonText}>Save Workout</Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  workoutNameDisplay: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.accent.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  exerciseList: {
    width: '100%',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseName: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  exerciseSets: {
    fontSize: font.sm,
    color: colors.text.secondary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    width: '100%',
    marginTop: spacing.xl,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: spacing.lg,
  },
  skipText: {
    color: colors.text.tertiary,
    fontSize: font.md,
    fontWeight: '600',
  },
});
