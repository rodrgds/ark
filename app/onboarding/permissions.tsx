import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import * as Location from 'expo-location';
import { View } from 'react-native';
import * as React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { Activity, CheckCircle2, Compass, MapPin, Waves } from 'lucide-react-native';

export default function PermissionsScreen() {
  const [locationStatus, setLocationStatus] = React.useState<Location.PermissionStatus | null>(
    null
  );

  React.useEffect(() => {
    Location.getForegroundPermissionsAsync().then((res) => setLocationStatus(res.status));
  }, []);

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationStatus(status);
  }

  const isLocationGranted = locationStatus === Location.PermissionStatus.GRANTED;

  return (
    <OnboardingFrame
      title="Access & Sensors"
      nextHref={'/onboarding/maps' as never}
      hideBranding
      arkyPose="navigator">
      <View className="gap-6">
        <Card className="gap-4 p-5">
          <View className="flex-row items-center gap-3">
            <View
              className={`h-10 w-10 items-center justify-center rounded-full ${isLocationGranted ? 'bg-primary/20' : 'bg-muted'}`}>
              <Icon
                as={MapPin}
                className={
                  isLocationGranted ? 'text-primary size-5' : 'text-muted-foreground size-5'
                }
              />
            </View>
            <View className="flex-1">
              <Text variant="large">Location Services</Text>
              <Text variant="muted" className="text-sm">
                Precise offline positioning
              </Text>
            </View>
          </View>

          <Text variant="muted">
            Used for saved coordinates, weather cache context, and offline map regions. Ark never
            sends your location to any server.
          </Text>

          <Button
            variant={isLocationGranted ? 'outline' : 'default'}
            onPress={requestLocation}
            disabled={isLocationGranted}
            className="flex-row gap-2">
            {isLocationGranted ? (
              <>
                <Icon as={CheckCircle2} className="text-primary size-4" />
                <Text>Access Granted</Text>
              </>
            ) : (
              <Text>Enable Location</Text>
            )}
          </Button>
        </Card>

        <View className="gap-4">
          <Text className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Sensor Integration
          </Text>

          <View className="flex-row flex-wrap gap-3">
            <SensorBadge icon={Compass} label="Direction" />
            <SensorBadge icon={Waves} label="Pressure" />
            <SensorBadge icon={Activity} label="Motion" />
          </View>

          <Text variant="muted" className="text-sm italic">
            Sensors like the compass, level, and barometer request access only when you first open
            the corresponding tool.
          </Text>
        </View>

        <View className="bg-muted/30 rounded-xl p-4">
          <Text variant="muted" className="text-center text-sm">
            Everything is skippable and can be revoked anytime in System Settings.
          </Text>
        </View>
      </View>
    </OnboardingFrame>
  );
}

function SensorBadge({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View className="bg-muted flex-row items-center gap-2 rounded-full px-3 py-1.5">
      <Icon as={icon} className="text-muted-foreground size-3.5" />
      <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
    </View>
  );
}
