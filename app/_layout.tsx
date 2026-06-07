import '../polyfills';
import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { BottomSheetProvider } from '@swmansion/react-native-bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ArkMark } from '@/components/brand/ark-logo';
import { ArkKeyboardProvider } from '@/components/layout/keyboard-controller';
import { Progress } from '@/components/ui/progress';
import { SheetAlertProvider } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { AutoLockService } from '@/services/security/autolock.service';
import { useAppStore } from '@/stores/app-store';
import { useThemeStore } from '@/stores/theme-store';

initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const boot = useAppStore((state) => state.boot);
  const retryBoot = useAppStore((state) => state.retryBoot);
  const booted = useAppStore((state) => state.booted);
  const booting = useAppStore((state) => state.booting);
  const bootProgress = useAppStore((state) => state.bootProgress);
  const bootStatus = useAppStore((state) => state.bootStatus);
  const error = useAppStore((state) => state.error);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);

  React.useEffect(() => {
    boot();
  }, [boot]);

  React.useEffect(() => AutoLockService.bindAppState(), []);

  if (!booted) {
    return (
      <GestureHandlerRootView className="bg-background flex-1">
        <SafeAreaProvider>
          <View className="bg-background flex-1 items-center justify-center gap-5 p-6">
            <BootSplashMark />
            <View className="w-full max-w-72 items-center gap-2">
              {error ? (
                <>
                  <Text variant="default" className="text-center font-medium">
                    Ark could not finish starting up.
                  </Text>
                  <Text variant="muted" className="text-center">
                    {error}
                  </Text>
                  <Pressable
                    onPress={retryBoot}
                    disabled={booting}
                    className="bg-primary mt-2 rounded-md px-4 py-2">
                    <Text className="text-primary-foreground">{booting ? 'Retrying…' : 'Try again'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Progress value={bootProgress} />
                  <Text variant="muted" className="text-center">
                    {bootStatus}
                  </Text>
                </>
              )}
            </View>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="bg-background flex-1">
      <SafeAreaProvider>
        <ArkKeyboardProvider>
          <ThemedNavigator effectiveTheme={effectiveTheme} error={error} />
        </ArkKeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedNavigator({
  effectiveTheme,
  error,
}: {
  effectiveTheme: 'oled' | 'dark' | 'light';
  error: string | null;
}) {
  const themeColors = React.useMemo(
    () => NAV_THEME[effectiveTheme].colors,
    [effectiveTheme]
  );

  return (
    <ThemeProvider value={NAV_THEME[effectiveTheme]}>
      <BottomSheetProvider>
        <SheetAlertProvider>
          <StatusBar style={effectiveTheme === 'light' ? 'dark' : 'light'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: themeColors.background },
              headerTintColor: themeColors.text,
              contentStyle: { backgroundColor: themeColors.background },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat" options={{ headerShown: false }} />
            <Stack.Screen name="tools" options={{ headerShown: false }} />
            <Stack.Screen name="content" options={{ headerShown: false }} />
            <Stack.Screen name="documents" options={{ headerShown: false }} />
            <Stack.Screen name="library" options={{ headerShown: false }} />
            <Stack.Screen name="easter-egg" options={{ headerShown: false }} />
            <Stack.Screen name="notes" options={{ headerShown: false }} />
          </Stack>
          {error ? (
            <View className="bg-destructive p-3">
              <Text className="text-white">{error}</Text>
            </View>
          ) : null}
          <PortalHost />
        </SheetAlertProvider>
      </BottomSheetProvider>
    </ThemeProvider>
  );
}

function BootSplashMark() {
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      }),
      -1,
      false
    );
  }, [pulse]);

  const outerPulseStyle = useAnimatedStyle(() => {
    const phase = pulse.value;
    return {
      opacity: interpolate(phase, [0, 0.55, 1], [0.26, 0.1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(phase, [0, 1], [0.84, 1.6], Extrapolation.CLAMP) }],
    };
  });

  const middlePulseStyle = useAnimatedStyle(() => {
    const phase = (pulse.value + 0.34) % 1;
    return {
      opacity: interpolate(phase, [0, 0.5, 1], [0.2, 0.08, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(phase, [0, 1], [0.9, 1.42], Extrapolation.CLAMP) }],
    };
  });

  const innerPulseStyle = useAnimatedStyle(() => {
    const phase = (pulse.value + 0.68) % 1;
    return {
      opacity: interpolate(phase, [0, 0.45, 1], [0.16, 0.08, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(phase, [0, 1], [0.96, 1.24], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View className="items-center justify-center" style={{ width: 132, height: 132 }}>
      <Animated.View
        className="absolute rounded-full bg-white"
        style={[{ width: 116, height: 116 }, outerPulseStyle]}
      />
      <Animated.View
        className="absolute rounded-full bg-white"
        style={[{ width: 104, height: 104 }, middlePulseStyle]}
      />
      <Animated.View
        className="absolute rounded-full bg-white"
        style={[{ width: 92, height: 92 }, innerPulseStyle]}
      />
      <View className="absolute rounded-full bg-white/10" style={{ width: 92, height: 92 }} />
      <ArkMark size={72} />
    </View>
  );
}
