import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import * as Location from 'expo-location';
import { View } from 'react-native';

export default function PermissionsScreen() {
  async function requestLocation() {
    await Location.requestForegroundPermissionsAsync().catch(() => undefined);
  }

  return (
    <OnboardingFrame title="Permissions" nextHref="/onboarding/packs">
      <Card className="gap-3">
        <Text variant="large">Location</Text>
        <Text variant="muted">
          Used for saved coordinates, weather cache context, and future offline map regions.
        </Text>
        <Button variant="outline" onPress={requestLocation}>
          <Text>Request location</Text>
        </Button>
      </Card>
      <Card className="gap-3">
        <Text variant="large">Motion and sensors</Text>
        <Text variant="muted">
          Compass, level, barometer, pedometer, and light meter request access when opened.
        </Text>
      </Card>
      <View>
        <Text variant="muted">
          Everything is skippable and can be configured later in Settings.
        </Text>
      </View>
    </OnboardingFrame>
  );
}
