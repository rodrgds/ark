import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { View } from 'react-native';
import { BatteryCharging, Zap, Sun, ZapOff } from 'lucide-react-native';

export default function PowerScreen() {
  return (
    <OnboardingFrame 
      title="Power Readiness" 
      nextHref="/onboarding/packs" 
      hideBranding 
      arkyPose="oled"
    >
      <View className="gap-6">
        <View className="bg-amber-500/10 border-amber-500/20 rounded-2xl border p-5">
          <View className="flex-row items-center gap-3">
            <Icon as={ZapOff} className="text-amber-500 size-6" />
            <Text className="text-amber-500 text-lg font-bold">Critical Requirement</Text>
          </View>
          <Text variant="muted" className="mt-2 leading-6">
            In real-world problematic circumstances, your device is only useful as long as it has power. Without a plan, Arky is just a black brick.
          </Text>
        </View>

        <View className="gap-4">
          <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest px-1">
            Recommended Hardware
          </Text>
          
          <PowerCard 
            icon={BatteryCharging} 
            title="High-Capacity Power Bank" 
            description="Minimum 20,000mAh for multiple full phone charges."
          />
          
          <PowerCard 
            icon={Sun} 
            title="Solar Charging" 
            description="Portable solar panels or solar-integrated banks for long-term use."
          />
          
          <PowerCard 
            icon={Zap} 
            title="Backup Generator" 
            description="For base-camp scenarios where fuel or large batteries are available."
          />
        </View>

        <View className="bg-muted/30 rounded-xl p-4">
          <Text variant="muted" className="text-center text-sm italic">
            "Prepare your energy source before you need it."
          </Text>
        </View>
      </View>
    </OnboardingFrame>
  );
}

function PowerCard({ icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <Card className="flex-row items-center gap-4 p-4">
      <View className="bg-primary/10 h-12 w-12 items-center justify-center rounded-xl">
        <Icon as={icon} className="text-primary size-6" />
      </View>
      <View className="flex-1">
        <Text className="font-bold">{title}</Text>
        <Text variant="muted" className="text-sm">{description}</Text>
      </View>
    </Card>
  );
}
