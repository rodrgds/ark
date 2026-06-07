import { OnboardingFeature } from '@/components/onboarding/onboarding-feature';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { useAppStore } from '@/stores/app-store';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Download, ShieldCheck, Zap } from 'lucide-react-native';

export default function FinishScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  return (
    <OnboardingFrame
      title="You are ready"
      nextLabel="Enter Ark"
      hideBranding
      arkyPose="prepared"
      step={8}
      totalSteps={8}
      onNext={async () => {
        await completeOnboarding();
        router.replace('/(tabs)/chat');
      }}>
      <View className="gap-4">
        <OnboardingFeature
          icon={ShieldCheck}
          title="Private by default"
          description="Your notes and documents stay behind the vault passphrase you set."
        />
        <OnboardingFeature
          icon={Zap}
          title="Instant Access"
          description="All tools work without a signal."
        />
        <OnboardingFeature
          icon={Download}
          title="Growing Library"
          description="Add more maps and guides anytime."
        />
      </View>
    </OnboardingFrame>
  );
}
