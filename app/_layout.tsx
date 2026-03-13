import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthBootstrap } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/utils/theme';

export default function RootLayout() {
  useAuthBootstrap();

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const initialized = useAuthStore((s) => s.initialized);
  const profileStatus = useAuthStore((s) => s.profileStatus);
  const segments = useSegments();
  const router = useRouter();
  const appReady = initialized && (!session || profileStatus === 'loaded' || profileStatus === 'missing');

  useEffect(() => {
    if (!appReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const currentSegments = segments as string[];

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session) {
      const needsOnboarding =
        profileStatus === 'missing' ||
        (profile != null && profile.onboarding_completed === false);
      if (needsOnboarding && !inAuthGroup) {
        router.replace('/(auth)/onboarding');
      } else if (needsOnboarding && inAuthGroup && currentSegments[1] !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      } else if (!needsOnboarding && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [appReady, session, profile, profileStatus, segments]);

  if (!appReady) {
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
        <Stack.Screen name="speedlog" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
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
