import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';
import * as React from 'react';

export default function ChatLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/*
        name="[threadId]"
        router.replace('/(tabs)/chat'
      */}
    </Stack>
  );
}
