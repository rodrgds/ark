import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

export default function TracksLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="[id]" options={{ title: 'Track' }} />
    </Stack>
  );
}
