import { NAV_THEME } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';
import * as React from 'react';

export default function ChatLayout() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen
        name="[threadId]"
        options={{
          title: 'Arky',
        }}
      />
    </Stack>
  );
}
