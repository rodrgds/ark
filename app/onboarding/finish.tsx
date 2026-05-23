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
      title="Ready for deployment"
      nextLabel="Get Started"
      hideBranding
      arkyPose="prepared"
      onNext={async () => {
        await completeOnboarding();
        router.replace('/(tabs)');
      }}>
      <View className="gap-8 py-4">
        <View className="gap-6">
          <FeatureItem 
            icon={ShieldCheck} 
            title="Privacy First" 
            description="Your data never leaves this device. No accounts, no tracking." 
          />
          <FeatureItem 
            icon={Zap} 
            title="Instant Access" 
            description="All tools and knowledge work without a cell signal." 
          />
          <FeatureItem 
            icon={Download} 
            title="Growing Library" 
            description="Download more maps and models anytime from the Library tab." 
          />
        </View>
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
    <View className="flex-row gap-4">
      <View className="bg-muted h-10 w-10 items-center justify-center rounded-xl">
        <Icon as={icon} className="text-primary size-5" />
      </View>
      <View className="flex-1">
        <Text className="font-bold">{title}</Text>
        <Text variant="muted" className="text-sm">{description}</Text>
      </View>
    </View>
  );
}
