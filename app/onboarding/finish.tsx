import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { SAFETY_COPY } from '@/constants/app';
import { useAppStore } from '@/stores/app-store';
import { router } from 'expo-router';

export default function FinishScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  async function finish() {
    await completeOnboarding();
    router.replace('/(tabs)');
  }

  return (
    <OnboardingFrame title="Local AI setup" nextLabel="Enter Ark" onNext={finish}>
      <Card className="gap-3">
        <Text variant="large">Optional model download</Text>
        <Text variant="muted">
          Ark is adapter-ready for llama.rn or @react-native-ai/llama, but this MVP uses a mock AI
          adapter and does not download a large model automatically.
        </Text>
        <Text className="text-destructive">{SAFETY_COPY.ai}</Text>
        <Button variant="outline">
          <Text>Model manager placeholder</Text>
        </Button>
      </Card>
    </OnboardingFrame>
  );
}
