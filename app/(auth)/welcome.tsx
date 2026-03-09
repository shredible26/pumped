import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, font, spacing, radius } from '@/utils/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>
          <Text style={styles.logoAccent}>P</Text>UMPED
        </Text>
        <Text style={styles.tagline}>
          AI-powered workouts.{'\n'}Track. Recover. Grow.
        </Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>
        <Pressable
          style={styles.outlineButton}
          onPress={() => router.push('/(auth)/signin')}
        >
          <Text style={styles.outlineButtonText}>I have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: 2,
  },
  logoAccent: {
    color: colors.accent.primary,
  },
  tagline: {
    fontSize: font.lg,
    color: colors.text.secondary,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: colors.accent.primary,
    marginTop: spacing.xxl,
    borderRadius: 2,
  },
  buttons: {
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: font.lg,
    fontWeight: '700',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.accent.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
});
