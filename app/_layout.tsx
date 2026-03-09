import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/utils/theme';

export default function RootLayout() {
  const { session, profile } = useAuth();
  const initialized = useAuthStore((s) => s.initialized);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const currentSegments = segments as string[];

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session) {
      const needsOnboarding = !profile || !profile.onboarding_completed;
      if (needsOnboarding && !inAuthGroup) {
        router.replace('/(auth)/onboarding');
      } else if (needsOnboarding && inAuthGroup && currentSegments[1] !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      } else if (!needsOnboarding && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [session, profile, initialized, segments]);

  if (!initialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.primary },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="history" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  loading: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
