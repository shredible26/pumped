import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
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
import { colors, font, spacing, radius } from '@/utils/theme';
import { DurationInput } from '@/components/ui/DurationInput';
import { useAuthStore } from '@/stores/authStore';
import { fetchCardioExercises } from '@/services/exercises';
import { createSession } from '@/services/workouts';
import { updateProfileStreak } from '@/services/streak';
import { supabase } from '@/services/supabase';
import { getLocalDateString } from '@/utils/date';
import { Exercise } from '@/types/exercise';

export default function CardioLogScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [cardioExercises, setCardioExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  const loadCardio = useCallback(async () => {
    try {
      const data = await fetchCardioExercises();
      setCardioExercises(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCardio();
  }, [loadCardio]);

  const handleSave = async () => {
    if (!session?.user?.id || !selectedExercise) {
      Alert.alert('Select activity', 'Choose a cardio activity first.');
      return;
    }
    setSaving(true);
    try {
      const durationSec = durationMinutes * 60;
      const ws = await createSession({
        user_id: session.user.id,
        date: getLocalDateString(),
        name: selectedExercise.name,
        completed: true,
        is_cardio: true,
        workout_type: null,
        source: 'custom',
        exercise_count: 1,
        set_count: 0,
        total_volume: 0,
        pr_count: 0,
        duration_seconds: durationSec,
        started_at: new Date(Date.now() - durationSec * 1000).toISOString(),
        completed_at: new Date().toISOString(),
      });

      const streakResult = await updateProfileStreak(session.user.id);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profileData) setProfile({ ...profileData, ...streakResult } as any);

      router.replace(`/workout/summary?sessionId=${ws.id}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save cardio.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Cardio</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Activity</Text>
          {cardioExercises.map((ex) => (
            <Pressable
              key={ex.id}
              style={[
                styles.exerciseRow,
                selectedExercise?.id === ex.id && styles.exerciseRowSelected,
              ]}
              onPress={() => setSelectedExercise(ex)}
            >
              <Text style={styles.exerciseName}>{ex.name}</Text>
              {selectedExercise?.id === ex.id && (
                <Ionicons name="checkmark-circle" size={22} color={colors.accent.primary} />
              )}
            </Pressable>
          ))}

          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Duration</Text>
          <View style={styles.durationCard}>
            <DurationInput
              totalMinutes={durationMinutes}
              onMinutesChange={setDurationMinutes}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, (!selectedExercise || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!selectedExercise || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.saveButtonText}>Save Cardio</Text>
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  keyboardAvoid: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { fontSize: font.md, color: colors.text.secondary },
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
  scroll: { flex: 1, paddingHorizontal: spacing.xl },
  sectionLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  exerciseRowSelected: {
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.bg,
  },
  exerciseName: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  durationCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: 36,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  saveButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
});
