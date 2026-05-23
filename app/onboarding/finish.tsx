import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { useAppStore } from '@/stores/app-store';
import { router } from 'expo-router';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { CheckCircle2, Download, ShieldCheck, Zap } from 'lucide-react-native';

export default function FinishScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  return (
    <OnboardingFrame
      title="You are ready"
      nextLabel="Enter Ark"
      hideBranding
      arkyPose="prepared"
      step={7}
      totalSteps={7}
      onNext={async () => {
        await completeOnboarding();
        router.replace('/(tabs)');
      }}>
      <View className="gap-4">
        <FeatureItem
          icon={ShieldCheck}
          title="Private by default"
          description="Your notes and documents stay behind the vault passphrase you set."
        />
        <FeatureItem
          icon={Zap}
          title="Instant Access"
          description="All tools work without a signal."
        />
        <FeatureItem
          icon={Download}
          title="Growing Library"
          description="Add more maps and guides anytime."
        />
      </View>
    </OnboardingFrame>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="bg-muted h-9 w-9 items-center justify-center rounded-lg">
        <Icon as={icon} className="text-primary size-4" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold">{title}</Text>
        <Text variant="muted" className="text-xs">
          {description}
        </Text>
      </View>
    </View>
  );
}
