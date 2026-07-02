import { Redirect, Stack } from 'expo-router';
import { useAppStore } from '@/stores/app-store';

export default function OnboardingLayout() {
  const onboarding = useAppStore((state) => state.onboarding);

  if (onboarding?.completedAt) {
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
