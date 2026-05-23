import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { type Href, router } from 'expo-router';
import { View } from 'react-native';
import { CheckCircle2, ShieldCheck, Zap, Download } from '@/components/ui/icon';

export default function FinishScreen() {
  return (
    <OnboardingFrame
      title="Ready for deployment"
      nextLabel="Get Started"
      hideBranding
      onNext={() => {
        router.replace('/(tabs)');
      }}>
      <View className="gap-8 py-4">
        <View className="items-center justify-center gap-4">
          <View className="bg-primary/20 h-24 w-24 items-center justify-center rounded-full">
            <CheckCircle2 size={48} className="text-primary" />
          </View>
          <Text variant="h3" className="text-center">Systems Online</Text>
        </View>

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

function FeatureItem({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <View className="flex-row gap-4">
      <View className="bg-muted h-10 w-10 items-center justify-center rounded-xl">
        <Icon size={20} className="text-primary" />
      </View>
      <View className="flex-1">
        <Text className="font-bold">{title}</Text>
        <Text variant="muted" className="text-sm">{description}</Text>
      </View>
    </View>
  );
}
