import { Card, CardHeader } from '@/components/ui/card';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

const cards = [
  ['Offline maps', 'Plan map packs and saved regions for no-service navigation.'],
  ['Knowledge packs', 'Keep practical references cached locally.'],
  ['Private vault', 'Secure notes and documents behind a local unlock step.'],
  ['Local AI', 'Adapter-ready offline assistant with RAG sources.'],
];

export default function IntroScreen() {
  return (
    <OnboardingFrame
      title="Build your offline command center"
      nextHref="/onboarding/security"
      onNext={async () => {
        await SettingsRepository.updateOnboardingState({ hasSeenIntro: true });
      }}>
      {cards.map(([title, description]) => (
        <Card key={title}>
          <CardHeader title={title} description={description} />
        </Card>
      ))}
    </OnboardingFrame>
  );
}
