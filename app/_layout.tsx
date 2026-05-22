import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { useAppStore } from '@/stores/app-store';
import { useThemeStore } from '@/stores/theme-store';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const boot = useAppStore((state) => state.boot);
  const booted = useAppStore((state) => state.booted);
  const error = useAppStore((state) => state.error);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);

  React.useEffect(() => {
    boot();
  }, [boot]);

  if (!booted) {
    return (
      <GestureHandlerRootView className="bg-background flex-1">
        <View className="bg-background flex-1 items-center justify-center p-6">
          <Text variant="h2">Ark</Text>
          <Text variant="muted">Preparing offline systems...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="bg-background flex-1">
      <ThemeProvider value={NAV_THEME[effectiveTheme]}>
        <StatusBar style={effectiveTheme === 'light' ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: NAV_THEME[effectiveTheme].colors.background },
            headerTintColor: NAV_THEME[effectiveTheme].colors.text,
            contentStyle: { backgroundColor: NAV_THEME[effectiveTheme].colors.background },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="tools" options={{ headerShown: true, title: 'Tool' }} />
        </Stack>
        {error ? (
          <View className="bg-destructive p-3">
            <Text className="text-white">{error}</Text>
          </View>
        ) : null}
        <PortalHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
