import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

export default function DocumentsLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
