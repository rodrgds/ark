import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

export default function ContentLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="[id]" options={{ title: 'Content' }} />
      <Stack.Screen name="reader" options={{ headerShown: false, gestureEnabled: true }} />
    </Stack>
  );
}
