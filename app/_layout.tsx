import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ArkMark } from '@/components/brand/ark-logo';
import { ArkKeyboardProvider } from '@/components/layout/keyboard-controller';
import { Text } from '@/components/ui/text';
import { AutoLockService } from '@/services/security/autolock.service';
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

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void AutoLockService.enforce();
      } else {
        void AutoLockService.touch();
      }
    });
    return () => subscription.remove();
  }, []);

  if (!booted) {
    return (
      <GestureHandlerRootView className="bg-background flex-1">
        <SafeAreaProvider>
          <View className="bg-background flex-1 items-center justify-center gap-3 p-6">
            <ArkMark size={64} />
            <Text variant="h2">Ark</Text>
            <Text variant="muted">Preparing offline systems...</Text>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="bg-background flex-1">
      <SafeAreaProvider>
        <ArkKeyboardProvider>
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
              <Stack.Screen name="tools" options={{ headerShown: false }} />
              <Stack.Screen name="content" options={{ headerShown: false }} />
              <Stack.Screen name="documents" options={{ headerShown: false }} />
              <Stack.Screen name="library" options={{ headerShown: false }} />
              <Stack.Screen name="easter-egg" options={{ headerShown: false }} />
              <Stack.Screen name="notes" />
            </Stack>
            {error ? (
              <View className="bg-destructive p-3">
                <Text className="text-white">{error}</Text>
              </View>
            ) : null}
            <PortalHost />
          </ThemeProvider>
        </ArkKeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
