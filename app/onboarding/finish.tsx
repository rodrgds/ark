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
        <Text variant="large">Ready for offline mode</Text>
        <Text variant="muted">
          Library handles Wikipedia, guides, documents, and GGUF models with visible download
          progress. Map handles regions and saved spots. Tools covers the field basics.
        </Text>
        <Text className="text-destructive">{SAFETY_COPY.ai}</Text>
      </Card>
    </OnboardingFrame>
  );
}
