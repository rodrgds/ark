import { NAV_THEME } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

export default function LibraryLayout() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="[category]" options={{ title: 'Library' }} />
    </Stack>
  );
}
