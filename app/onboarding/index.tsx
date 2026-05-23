import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { Icon } from '@/components/ui/icon';
import { Compass, Cpu, HardDrive, Shield } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

const features = [
  { title: 'Offline maps', icon: HardDrive },
  { title: 'Secure vault', icon: Shield },
  { title: 'Local AI', icon: Cpu },
  { title: 'Sensor tools', icon: Compass },
];

export default function IntroScreen() {
  return (
    <OnboardingFrame
      title="Offline Command Center"
      nextHref="/onboarding/security"
      hideBranding
      arkyPose="tactical"
      step={1}
      totalSteps={7}
      onNext={async () => {
        await SettingsRepository.updateOnboardingState({ hasSeenIntro: true });
      }}>
      <View className="gap-6">
        <Text className="text-foreground text-base leading-6">
          Set up the essentials now, then tune maps, downloads, and tools later.
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {features.map((item) => (
            <View
              key={item.title}
              className="bg-muted flex-row items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ width: '48%', minWidth: 0 }}>
              <Icon as={item.icon} className="text-primary size-3.5 shrink-0" />
              <Text className="min-w-0 flex-1 text-[11px] font-medium leading-4">{item.title}</Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingFrame>
  );
}
