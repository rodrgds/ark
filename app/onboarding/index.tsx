import { Card, CardHeader } from '@/components/ui/card';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

const cards = [
  ['Download before you leave', 'Maps, guides, weather, and references live on this device.'],
  ['Keep private notes close', 'The vault puts notes and documents behind a local unlock step.'],
  ['Ask with sources', 'Ark answers from downloaded material when a local model is available.'],
];

export default function IntroScreen() {
  return (
    <OnboardingFrame
      title="Build your offline command center"
      nextHref="/onboarding/security"
      onNext={async () => {
        await SettingsRepository.updateOnboardingState({ hasSeenIntro: true });
      }}>
      <Card className="border-primary/35 bg-primary/10 gap-2">
        <CardHeader
          title="Arky is your offline quartermaster"
          description="No account, no cloud sync, no hidden service dependency. Set up the basics now, tune everything later."
        />
      </Card>
      {cards.map(([title, description]) => (
        <Card key={title}>
          <CardHeader title={title} description={description} />
        </Card>
      ))}
    </OnboardingFrame>
  );
}
