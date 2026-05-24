import { Card } from '@/components/ui/card';
import { OnboardingFeature } from '@/components/onboarding/onboarding-feature';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { useMotionEnabled } from '@/hooks/use-motion-enabled';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { BatteryCharging, Sun, Zap, ZapOff } from 'lucide-react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';

const powerOptions = [
  {
    icon: Sun,
    title: 'Solar power bank',
    description: 'Recharges slowly in daylight.',
  },
  {
    icon: BatteryCharging,
    title: 'Battery power bank',
    description: 'Simple backup if kept charged.',
  },
  {
    icon: Zap,
    title: 'Generator or home battery',
    description: 'For longer outages, including solar-charged batteries.',
  },
];

export default function PowerScreen() {
  const motionEnabled = useMotionEnabled();

  return (
    <OnboardingFrame
      title="Power Readiness"
      nextHref="/onboarding/packs"
      hideBranding
      arkyPose="oled"
      step={5}
      totalSteps={8}>
      <View className="gap-5">
        <Card className="border-amber-500/20 bg-amber-500/10">
          <View className="flex-row items-start gap-3">
            <View className="size-9 items-center justify-center rounded-lg bg-amber-500/15">
              <Icon as={ZapOff} className="size-5 text-amber-500" />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-base font-semibold text-amber-500">Have one power backup</Text>
              <Text className="text-sm leading-5 text-amber-500/90">
                We recommend at least one option before an outage.
              </Text>
            </View>
          </View>
        </Card>

        <View className="gap-3">
          {powerOptions.map((item, index) => (
            <Animated.View
              key={item.title}
              entering={
                motionEnabled
                  ? FadeInUp.duration(220)
                      .delay(80 + index * 45)
                      .easing(Easing.out(Easing.quad))
                  : undefined
              }>
              <PowerItem icon={item.icon} title={item.title} description={item.description} />
            </Animated.View>
          ))}
        </View>

        <Text variant="muted" className="text-center text-sm leading-5">
          Solar, battery, or generator is enough. More is better.
        </Text>
      </View>
    </OnboardingFrame>
  );
}

function PowerItem({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-3">
      <OnboardingFeature
        icon={icon}
        title={title}
        description={description}
        iconTileClassName="bg-primary/10"
        className="items-start"
        titleClassName="text-[15px]"
      />
    </Card>
  );
}
