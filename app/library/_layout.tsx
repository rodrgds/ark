import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

export default function LibraryLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="[category]" options={{ title: 'Library' }} />
    </Stack>
  );
}
