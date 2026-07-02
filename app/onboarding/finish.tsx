import { OnboardingFeature } from '@/components/onboarding/onboarding-feature';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { useAppStore } from '@/stores/app-store';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Download, ShieldCheck, Zap } from 'lucide-react-native';

export default function FinishScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const vault = useAppStore((state) => state.vault);

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
          title={vault?.isInitialized ? 'Vault ready' : 'Fast access'}
          description={
            vault?.isInitialized
              ? 'Secure notes stay behind your passphrase.'
              : 'Passphrase protection is off for now. Turn it on later in Settings.'
          }
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
