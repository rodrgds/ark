import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { View } from 'react-native';
import { BatteryCharging, Sun, Zap, ZapOff } from 'lucide-react-native';

export default function PowerScreen() {
  return (
    <OnboardingFrame
      title="Power Readiness"
      nextHref="/onboarding/packs"
      hideBranding
      arkyPose="oled"
      step={5}
      totalSteps={7}>
      <View className="gap-5">
        <View className="bg-amber-500/10 border-amber-500/20 rounded-2xl border p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={ZapOff} className="text-amber-500 size-5" />
            <Text className="text-amber-500 font-semibold">Your device needs power to help you.</Text>
          </View>
        </View>

        <View className="gap-3">
          <PowerItem icon={BatteryCharging} title="20,000mAh+ power bank" />
          <PowerItem icon={Sun} title="Portable solar panel" />
          <PowerItem icon={Zap} title="Backup generator (base camp)" />
        </View>

        <Text variant="muted" className="text-center text-sm italic">
          Prepare your energy source before you need it.
        </Text>
      </View>
    </OnboardingFrame>
  );
}

function PowerItem({ icon, title }: { icon: any; title: string }) {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <View className="bg-primary/10 h-9 w-9 items-center justify-center rounded-lg">
        <Icon as={icon} className="text-primary size-4" />
      </View>
      <Text className="font-medium">{title}</Text>
    </Card>
  );
}
