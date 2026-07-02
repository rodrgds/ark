import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

export default function NotesLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="editor" options={{ title: 'Note' }} />
      <Stack.Screen name="labels" options={{ title: 'Labels' }} />
    </Stack>
  );
}
