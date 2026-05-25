import * as React from 'react';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { Button } from '@/components/ui/button';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { PreferencesService, type InterfaceMode } from '@/services/preferences/preferences.service';
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
  const [interfaceMode, setInterfaceMode] = React.useState<InterfaceMode>('simple');

  React.useEffect(() => {
    PreferencesService.getInterfaceMode().then(setInterfaceMode).catch(() => undefined);
  }, []);

  return (
    <OnboardingFrame
      title="Offline Command Center"
      nextHref="/onboarding/security"
      hideBranding
      arkyPose="tactical"
      step={1}
      totalSteps={8}
      onNext={async () => {
        await Promise.all([
          PreferencesService.setInterfaceMode(interfaceMode),
          SettingsRepository.updateOnboardingState({ hasSeenIntro: true }),
        ]);
      }}>
      <View className="gap-6">
        <Text className="text-foreground text-base leading-6">
          Set up the essentials now, then tune maps, downloads, and tools later.
        </Text>

        <View className="gap-3">
          <View className="gap-1">
            <Text className="font-semibold">Interface mode</Text>
            <Text variant="muted" className="text-sm leading-5">
              Simple keeps technical AI details out of the way. Technical shows model names,
              runtime details, and indexing diagnostics.
            </Text>
          </View>
          <View className="border-border bg-muted/20 flex-row rounded-md border p-1">
            {(['simple', 'technical'] as const).map((mode) => (
              <Button
                key={mode}
                className="flex-1"
                size="sm"
                variant={interfaceMode === mode ? 'default' : 'ghost'}
                onPress={() => setInterfaceMode(mode)}>
                <Text>{mode === 'simple' ? 'Simple' : 'Technical'}</Text>
              </Button>
            ))}
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {features.map((item) => (
            <View
              key={item.title}
              className="bg-muted flex-row items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ width: '48%', minWidth: 0 }}>
              <Icon as={item.icon} className="text-primary size-3.5 shrink-0" />
              <Text className="min-w-0 flex-1 text-[11px] leading-4 font-medium">{item.title}</Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingFrame>
  );
}
