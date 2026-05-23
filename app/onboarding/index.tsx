import { Card } from '@/components/ui/card';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { Icon } from '@/components/ui/icon';
import { Compass, Cpu, HardDrive, Shield } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

const features = [
  {
    title: 'Download everything',
    description: 'Maps, guides, and references live locally on this device.',
    icon: HardDrive,
  },
  {
    title: 'Private Vault',
    description: 'Sensitive notes and documents are locked behind local biometrics.',
    icon: Shield,
  },
  {
    title: 'Offline AI',
    description: 'Ask questions using local models without an internet connection.',
    icon: Cpu,
  },
  {
    title: 'Survival Tools',
    description: 'Built-in sensors for compass, level, and environment monitoring.',
    icon: Compass,
  },
];

export default function IntroScreen() {
  return (
    <OnboardingFrame
      title="Offline Command Center"
      nextHref="/onboarding/security"
      hideBranding
      arkyPose="tactical"
      onNext={async () => {
        await SettingsRepository.updateOnboardingState({ hasSeenIntro: true });
      }}>
      <View className="gap-4">
        <View className="bg-primary/10 border-primary/20 rounded-2xl border p-5">
          <Text className="text-primary text-lg font-bold">Arky is your quartermaster</Text>
          <Text variant="muted" className="mt-1">
            No accounts, no cloud, no dependencies. Set up the basics now and tune everything later.
          </Text>
        </View>

        <View className="gap-3">
          {features.map((item) => (
            <Card key={item.title} className="flex-row items-center gap-4 p-4">
              <View className="bg-muted h-10 w-10 items-center justify-center rounded-xl">
                <Icon as={item.icon} className="text-primary size-5" />
              </View>
              <View className="flex-1">
                <Text className="font-bold">{item.title}</Text>
                <Text variant="muted" className="text-sm">{item.description}</Text>
              </View>
            </Card>
          ))}
        </View>
      </View>
    </OnboardingFrame>
  );
}
