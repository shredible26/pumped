import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';

const MUSCLE_PILLS = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs', 'Full Body',
];

const PPL_TYPES = ['Push', 'Pull', 'Legs'];
const UL_TYPES = ['Upper', 'Lower'];
const BRO_TYPES = ['Chest/Tris', 'Back/Bis', 'Shoulders', 'Legs', 'Arms'];
const FB_TYPES = ['Full Body'];

function getSplitTypes(style: string | undefined): string[] {
  switch (style) {
    case 'ppl': return PPL_TYPES;
    case 'upper_lower': return UL_TYPES;
    case 'bro_split': return BRO_TYPES;
    case 'full_body': return FB_TYPES;
    default: return PPL_TYPES;
  }
}

function getRecommendedType(style: string | undefined): string {
  const dayOfWeek = new Date().getDay();
  const types = getSplitTypes(style);
  return types[dayOfWeek % types.length] ?? types[0];
}

export default function SpeedLogTypeScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const programStyle = profile?.program_style;
  const recommended = getRecommendedType(programStyle);
  const allTypes = getSplitTypes(programStyle);
  const otherTypes = allTypes.filter((t) => t !== recommended);

  const selectType = (type: string) => {
    router.push({ pathname: '/speedlog/editor', params: { type } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Speed Log</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.subtitle}>What did you work on?</Text>

        {/* Scheduled / recommended */}
        <Text style={styles.sectionLabel}>SCHEDULED</Text>
        <Pressable
          style={styles.recommendedCard}
          onPress={() => selectType(recommended)}
        >
          <View style={styles.recommendedLeft}>
            <Ionicons name="calendar" size={20} color={colors.accent.primary} />
            <Text style={styles.recommendedText}>{recommended}</Text>
          </View>
          <View style={styles.bestMatchBadge}>
            <Text style={styles.bestMatchText}>BEST MATCH</Text>
          </View>
        </Pressable>

        {/* Other split types */}
        {otherTypes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR SPLIT</Text>
            {otherTypes.map((type) => (
              <Pressable
                key={type}
                style={styles.typeCard}
                onPress={() => selectType(type)}
              >
                <Ionicons
                  name="barbell-outline"
                  size={18}
                  color={colors.text.secondary}
                />
                <Text style={styles.typeText}>{type}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.text.tertiary}
                />
              </Pressable>
            ))}
          </>
        )}

        {/* Muscle group pills */}
        <Text style={styles.sectionLabel}>OR PICK A MUSCLE GROUP</Text>
        <View style={styles.pillGrid}>
          {MUSCLE_PILLS.map((muscle) => (
            <Pressable
              key={muscle}
              style={styles.musclePill}
              onPress={() => selectType(muscle)}
            >
              <Text style={styles.musclePillText}>{muscle}</Text>
            </Pressable>
          ))}
        </View>

        {/* Build your own */}
        <Text style={styles.sectionLabel}>OR START FROM SCRATCH</Text>
        <Pressable
          style={styles.scratchCard}
          onPress={() => selectType('Custom')}
        >
          <View style={styles.scratchIcon}>
            <Ionicons name="add" size={24} color={colors.accent.primary} />
          </View>
          <View>
            <Text style={styles.scratchTitle}>Build Your Own</Text>
            <Text style={styles.scratchSubtext}>
              Pick exercises, sets & reps from scratch
            </Text>
          </View>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  subtitle: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  recommendedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  recommendedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recommendedText: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  bestMatchBadge: {
    backgroundColor: colors.accent.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  bestMatchText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent.primary,
    letterSpacing: 0.5,
  },
  typeCard: {
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
  typeText: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  musclePill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  musclePillText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scratchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  scratchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scratchTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scratchSubtext: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
