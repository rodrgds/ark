import '../polyfills';
import '@/global.css';

import { getNavigationTheme } from '@/lib/theme';
import { BottomSheetProvider } from '@swmansion/react-native-bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { PortalHost } from '@rn-primitives/portal';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { LogBox, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ArkKeyboardProvider } from '@/components/layout/keyboard-controller';
import { SheetAlertProvider } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { AutoLockService } from '@/services/security/autolock.service';
import { useAppStore } from '@/stores/app-store';
import { useThemeStore } from '@/stores/theme-store';

initExecutorch({ resourceFetcher: ExpoResourceFetcher });
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'ProgressBarAndroid has been extracted from react-native core',
  'Clipboard has been extracted from react-native core',
  'InteractionManager has been deprecated',
  '[React Native ExecuTorch] No content-length header',
]);
SplashScreen.setOptions({ duration: 220, fade: true });
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const boot = useAppStore((state) => state.boot);
  const retryBoot = useAppStore((state) => state.retryBoot);
  const booted = useAppStore((state) => state.booted);
  const booting = useAppStore((state) => state.booting);
  const error = useAppStore((state) => state.error);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const accentPreference = useThemeStore((state) => state.accentPreference);

  React.useEffect(() => {
    boot();
  }, [boot]);

  React.useEffect(() => AutoLockService.bindAppState(), []);

  React.useEffect(() => {
    const unbindDownloads = DownloadManagerService.bindLifecycle();
    const unbindMaps = OfflineMapService.bindLifecycle();
    return () => {
      unbindDownloads();
      unbindMaps();
    };
  }, []);

  React.useEffect(() => {
    if (booted || error) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [booted, error]);

  if (!booted) {
    if (!error) return null;
    return (
      <GestureHandlerRootView className="bg-background flex-1">
        <SafeAreaProvider>
          <View className="bg-background flex-1 items-center justify-center gap-5 p-6">
            <View className="w-full max-w-72 items-center gap-2">
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
                <Text className="text-primary-foreground">
                  {booting ? 'Retrying…' : 'Try again'}
                </Text>
              </Pressable>
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
          <ThemedNavigator
            accentPreference={accentPreference}
            effectiveTheme={effectiveTheme}
            error={error}
          />
        </ArkKeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedNavigator({
  accentPreference,
  effectiveTheme,
  error,
}: {
  accentPreference: ReturnType<typeof useThemeStore.getState>['accentPreference'];
  effectiveTheme: ReturnType<typeof useThemeStore.getState>['effectiveTheme'];
  error: string | null;
}) {
  const navTheme = React.useMemo(
    () => getNavigationTheme(effectiveTheme, accentPreference),
    [accentPreference, effectiveTheme]
  );
  const themeColors = navTheme.colors;
  useDownloadNotificationNavigation();

  return (
    <ThemeProvider value={navTheme}>
      <BottomSheetProvider>
        <SheetAlertProvider>
          <View className="flex-1" onTouchStart={AutoLockService.touch}>
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
          </View>
        </SheetAlertProvider>
      </BottomSheetProvider>
    </ThemeProvider>
  );
}

function useDownloadNotificationNavigation() {
  React.useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    const handled = new Set<string>();

    function handleResponse(response: {
      notification?: {
        request?: {
          identifier?: string;
          content?: { data?: Record<string, unknown> };
        };
      };
    } | null) {
      const request = response?.notification?.request;
      const data = request?.content?.data;
      if (!data?.downloadId) return;
      const key = request?.identifier ?? String(data.downloadId);
      if (handled.has(key)) return;
      handled.add(key);
      const downloadId = String(data.downloadId);
      router.push({
        pathname: '/(tabs)/settings',
        params: { tab: 'downloads', downloadId },
      });
    }

    void import('expo-notifications')
      .then((Notifications) => {
        subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
        void Notifications.getLastNotificationResponseAsync?.()
          .then(handleResponse)
          .catch(() => undefined);
      })
      .catch(() => undefined);

    return () => subscription?.remove();
  }, []);
}
