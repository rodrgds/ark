import '../polyfills';
import '@/global.css';

import { ArkMark } from '@/components/brand/ark-logo';
import { Text } from '@/components/ui/text';
import { APP_SLOGAN } from '@/constants/app';
import { ErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export { ErrorBoundary };

export default function WebRootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView className="bg-background flex-1">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="w-full max-w-xl gap-8">
            <View className="gap-4">
              <ArkMark size={72} />
              <View className="gap-2">
                <Text variant="h1">Ark is a mobile app</Text>
                <Text variant="muted" className="text-lg leading-7">
                  {APP_SLOGAN}
                </Text>
              </View>
            </View>

            <View className="border-border bg-card gap-3 rounded-2xl border p-5">
              <Text variant="h4">Use an iOS or Android development build</Text>
              <Text variant="muted" className="leading-6">
                The browser cannot provide Ark&apos;s native secure storage, FTS5 and sqlite-vec
                search, offline maps, local AI models, sensors, or background location. Ark does not
                simulate these systems in the browser.
              </Text>
            </View>

            <Text variant="muted" className="max-w-lg leading-6">
              This preview checks the web toolchain only. Test product behavior and releases on a
              mobile device; the browser is not a substitute for Ark&apos;s offline features.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
