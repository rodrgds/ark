import { Redirect, Stack } from 'expo-router';
import { useAppStore } from '@/stores/app-store';

export default function OnboardingLayout() {
  const onboarding = useAppStore((state) => state.onboarding);
  const vault = useAppStore((state) => state.vault);

  if (onboarding?.completedAt && vault?.isInitialized) {
    return <Redirect href="/(tabs)/chat" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
