import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import * as Location from 'expo-location';
import { View } from 'react-native';
import * as React from 'react';
import { CheckCircle2, MapPin } from 'lucide-react-native';

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
      title="Location Access"
      nextHref={'/onboarding/maps'}
      hideBranding
      arkyPose="navigator"
      step={3}
      totalSteps={8}>
      <View className="gap-5">
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
              <Text className="font-semibold">Offline positioning</Text>
              <Text variant="muted" className="text-sm">
                Used only for saved coordinates and maps.
              </Text>
            </View>
          </View>

          <Button
            variant={isLocationGranted ? 'outline' : 'default'}
            onPress={requestLocation}
            disabled={isLocationGranted}
            className="flex-row gap-2 rounded-xl">
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

        <Text variant="muted" className="text-center text-sm">
          You can change this anytime in Settings.
        </Text>
      </View>
    </OnboardingFrame>
  );
}
