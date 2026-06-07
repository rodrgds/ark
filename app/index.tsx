import { Text } from '@/components/ui/text';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAppStore } from '@/stores/app-store';

export default function Screen() {
  const booted = useAppStore((state) => state.booted);
  const onboarding = useAppStore((state) => state.onboarding);

  if (!booted) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Text>Loading Ark...</Text>
      </View>
    );
  }

  if (!onboarding?.completedAt) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/chat" />;
}
