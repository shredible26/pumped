import { Stack } from 'expo-router';
import { colors } from '@/utils/theme';

export default function CardioLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    />
  );
}
