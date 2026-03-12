import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { initializeFatigue } from '@/services/fatigue';
import { useAuthStore } from '@/stores/authStore';
import { e1rm, strengthScore } from '@/utils/epley';
import { PROGRAM_STYLES, EQUIPMENT_OPTIONS } from '@/utils/constants';
import { colors, font, spacing, radius } from '@/utils/theme';

const PROGRAM_COLORS: Record<string, string> = {
  ppl: '#8B5CF6',
  upper_lower: '#3B82F6',
  aesthetic: '#EC4899',
  ai_optimal: '#4ADE80',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { session, setProfile } = useAuthStore();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weight, setWeight] = useState('');

  // Step 2
  const [program, setProgram] = useState<string | null>(null);
  const [frequency, setFrequency] = useState(4);
  const [equipment, setEquipment] = useState('full_gym');

  // Step 3: 1-rep max only — weight optional, reps fixed at 1
  const [lifts, setLifts] = useState({
    squat: { weight: '' },
    bench: { weight: '' },
    deadlift: { weight: '' },
  });

  const updateLiftWeight = (lift: 'squat' | 'bench' | 'deadlift', value: string) => {
    setLifts((prev) => ({ ...prev, [lift]: { weight: value } }));
  };

  const canAdvance = () => {
    if (step === 0) return gender !== null;
    if (step === 1) return program !== null;
    return true;
  };

  const handleComplete = async (skip = false) => {
    if (!session?.user) return;
    setSaving(true);

    try {
      const totalInches = (parseInt(heightFt) || 0) * 12 + (parseInt(heightIn) || 0);
      // 1RM: reps are always 1 when weight is entered
      const sqE1rm = !skip && lifts.squat.weight && Number(lifts.squat.weight) > 0
        ? e1rm(parseFloat(lifts.squat.weight), 1)
        : 0;
      const bnE1rm = !skip && lifts.bench.weight && Number(lifts.bench.weight) > 0
        ? e1rm(parseFloat(lifts.bench.weight), 1)
        : 0;
      const dlE1rm = !skip && lifts.deadlift.weight && Number(lifts.deadlift.weight) > 0
        ? e1rm(parseFloat(lifts.deadlift.weight), 1)
        : 0;
      const score = strengthScore(sqE1rm, bnE1rm, dlE1rm);

      const profileUpdate = {
        gender,
        age: age ? parseInt(age) : null,
        height_inches: totalInches > 0 ? totalInches : null,
        weight_lbs: weight ? parseFloat(weight) : null,
        program_style: program,
        training_frequency: frequency,
        equipment_access: equipment,
        squat_e1rm: sqE1rm,
        bench_e1rm: bnE1rm,
        deadlift_e1rm: dlE1rm,
        strength_score: score,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', session.user.id);

      if (profileError) throw profileError;

      await initializeFatigue(session.user.id);

      if (score > 0) {
        await supabase.from('strength_history').upsert({
          user_id: session.user.id,
          squat_e1rm: sqE1rm,
          bench_e1rm: bnE1rm,
          deadlift_e1rm: dlE1rm,
          total_score: score,
        });
      }

      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (freshProfile) setProfile(freshProfile);

      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  // Avoid double-submit and ensure we always clear saving state
  const handleCompleteSafe = (skip: boolean) => {
    if (saving) return;
    void handleComplete(skip);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Progress bar */}
        <View style={styles.progressBar}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= step && styles.progressActive,
                i === step && styles.progressCurrent,
              ]}
            />
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <StepAboutYou
              gender={gender}
              setGender={setGender}
              age={age}
              setAge={setAge}
              heightFt={heightFt}
              setHeightFt={setHeightFt}
              heightIn={heightIn}
              setHeightIn={setHeightIn}
              weight={weight}
              setWeight={setWeight}
            />
          )}
          {step === 1 && (
            <StepTrainingStyle
              program={program}
              setProgram={setProgram}
              frequency={frequency}
              setFrequency={setFrequency}
              equipment={equipment}
              setEquipment={setEquipment}
            />
          )}
          {step === 2 && (
            <StepStrengthCheck lifts={lifts} updateLiftWeight={updateLiftWeight} />
          )}
        </ScrollView>

        {/* Bottom buttons */}
        <View style={styles.footer}>
          {step > 0 && (
            <Pressable style={styles.backButton} onPress={() => setStep(step - 1)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          )}

          {step < 2 ? (
            <Pressable
              style={[styles.nextButton, !canAdvance() && styles.buttonDisabled]}
              onPress={() => setStep(step + 1)}
              disabled={!canAdvance()}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </Pressable>
          ) : (
            <View style={styles.finalButtons}>
              <Pressable
                style={styles.skipButton}
                onPress={() => handleCompleteSafe(true)}
                disabled={saving}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </Pressable>
              <Pressable
                style={[styles.nextButton, styles.startButton, saving && styles.buttonDisabled]}
                onPress={() => handleCompleteSafe(false)}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.nextButtonText}>Start Training</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── Step 1: About You ─── */

function StepAboutYou({
  gender, setGender, age, setAge,
  heightFt, setHeightFt, heightIn, setHeightIn,
  weight, setWeight,
}: {
  gender: string | null; setGender: (v: string) => void;
  age: string; setAge: (v: string) => void;
  heightFt: string; setHeightFt: (v: string) => void;
  heightIn: string; setHeightIn: (v: string) => void;
  weight: string; setWeight: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>About You</Text>
      <Text style={styles.stepSubtitle}>Tell us about yourself to personalize your training.</Text>

      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        {(['male', 'female'] as const).map((g) => (
          <Pressable
            key={g}
            style={[styles.genderButton, gender === g && styles.genderSelected]}
            onPress={() => setGender(g)}
          >
            <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={styles.input}
        placeholder="25"
        placeholderTextColor={colors.text.tertiary}
        keyboardType="number-pad"
        value={age}
        onChangeText={setAge}
        maxLength={3}
      />

      <Text style={styles.label}>Height</Text>
      <View style={styles.heightRow}>
        <View style={styles.heightInputWrap}>
          <TextInput
            style={styles.input}
            placeholder="5"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="number-pad"
            value={heightFt}
            onChangeText={setHeightFt}
            maxLength={1}
          />
          <Text style={styles.unitLabel}>ft</Text>
        </View>
        <View style={styles.heightInputWrap}>
          <TextInput
            style={styles.input}
            placeholder="10"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="number-pad"
            value={heightIn}
            onChangeText={setHeightIn}
            maxLength={2}
          />
          <Text style={styles.unitLabel}>in</Text>
        </View>
      </View>

      <Text style={styles.label}>Weight (lbs)</Text>
      <TextInput
        style={styles.input}
        placeholder="180"
        placeholderTextColor={colors.text.tertiary}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
        maxLength={5}
      />
    </View>
  );
}

/* ─── Step 2: Training Style ─── */

function StepTrainingStyle({
  program, setProgram, frequency, setFrequency, equipment, setEquipment,
}: {
  program: string | null; setProgram: (v: string) => void;
  frequency: number; setFrequency: (v: number) => void;
  equipment: string; setEquipment: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>How do you like to train?</Text>
      <Text style={styles.stepSubtitle}>Pick the program that fits your style.</Text>

      {PROGRAM_STYLES.map((p) => {
        const color = PROGRAM_COLORS[p.id];
        const selected = program === p.id;
        return (
          <Pressable
            key={p.id}
            style={[
              styles.programCard,
              selected && { borderColor: color, backgroundColor: color + '14' },
            ]}
            onPress={() => setProgram(p.id)}
          >
            <View style={styles.programHeader}>
              <View style={[styles.programDot, { backgroundColor: color }]} />
              <Text style={[styles.programLabel, selected && { color }]}>{p.label}</Text>
            </View>
            <Text style={styles.programDesc}>{p.description}</Text>
          </Pressable>
        );
      })}

      <Text style={[styles.label, { marginTop: spacing.xxl }]}>Days per week</Text>
      <View style={styles.pillRow}>
        {[2, 3, 4, 5, 6].map((d) => (
          <Pressable
            key={d}
            style={[styles.pill, frequency === d && styles.pillSelected]}
            onPress={() => setFrequency(d)}
          >
            <Text style={[styles.pillText, frequency === d && styles.pillTextSelected]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Equipment</Text>
      <View style={styles.pillRow}>
        {EQUIPMENT_OPTIONS.map((e) => (
          <Pressable
            key={e.id}
            style={[styles.equipPill, equipment === e.id && styles.pillSelected]}
            onPress={() => setEquipment(e.id)}
          >
            <Text style={[styles.pillText, equipment === e.id && styles.pillTextSelected]}>
              {e.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ─── Step 3: Quick Strength Check (1-rep max only) ─── */

function StepStrengthCheck({
  lifts,
  updateLiftWeight,
}: {
  lifts: { squat: { weight: string }; bench: { weight: string }; deadlift: { weight: string } };
  updateLiftWeight: (lift: 'squat' | 'bench' | 'deadlift', value: string) => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>Quick Strength Check</Text>
      <Text style={styles.stepSubtitle}>
        Optionally enter your 1-rep max (lbs) for each lift to calibrate your plan.
      </Text>

      {(['squat', 'bench', 'deadlift'] as const).map((lift) => (
        <View key={lift} style={styles.liftRow}>
          <Text style={styles.liftName}>
            {lift === 'squat' ? 'Squat' : lift === 'bench' ? 'Bench Press' : 'Deadlift'}
          </Text>
          <View style={styles.liftInputs}>
            <View style={styles.liftInputWrap}>
              <TextInput
                style={styles.liftInput}
                placeholder="Optional"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                value={lifts[lift].weight}
                onChangeText={(v) => updateLiftWeight(lift, v)}
                maxLength={5}
                editable={true}
              />
              <Text style={styles.liftUnit}>lbs</Text>
            </View>
            <Text style={styles.liftX}>×</Text>
            <Text style={styles.liftRepsFixed}>1 rep</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  // Progress
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  progressDot: {
    height: 4,
    flex: 1,
    maxWidth: 80,
    borderRadius: 2,
    backgroundColor: colors.border.light,
  },
  progressActive: {
    backgroundColor: colors.accent.dim,
  },
  progressCurrent: {
    backgroundColor: colors.accent.primary,
  },

  // Step content
  stepTitle: {
    fontSize: font.xxxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xl,
  },
  stepSubtitle: {
    fontSize: font.md,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    lineHeight: 20,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.lg,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  // Gender
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  genderSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.bg,
  },
  genderText: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  genderTextSelected: {
    color: colors.accent.primary,
  },

  // Height
  heightRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  heightInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unitLabel: {
    fontSize: font.md,
    color: colors.text.secondary,
  },

  // Program cards
  programCard: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  programDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  programLabel: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  programDesc: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  equipPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pillSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.bg,
  },
  pillText: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  pillTextSelected: {
    color: colors.accent.primary,
  },

  // Lift rows
  liftRow: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  liftName: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  liftInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liftInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
  },
  liftInput: {
    flex: 1,
    fontSize: font.lg,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  liftUnit: {
    fontSize: font.sm,
    color: colors.text.tertiary,
  },
  liftX: {
    fontSize: font.lg,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  liftRepsFixed: {
    fontSize: font.md,
    color: colors.text.secondary,
    fontWeight: '600',
    minWidth: 48,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.text.secondary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  finalButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  skipButtonText: {
    color: colors.text.tertiary,
    fontSize: font.md,
    fontWeight: '600',
  },
  startButton: {
    flex: 1,
  },
});
