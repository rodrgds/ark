import { NAV_THEME } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

export default function NotesLayout() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="editor" options={{ title: 'Note' }} />
      <Stack.Screen name="labels" options={{ title: 'Labels' }} />
    </Stack>
  );
}
