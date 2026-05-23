import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { LevelService } from '@/services/sensors/level.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';
import { View } from 'react-native';

type LevelValue = { pitch: number; roll: number };

export default function LevelTool() {
  const setStoreLevel = useSensorStore((state) => state.setLevel);
  const publishLevel = React.useCallback(
    (v: LevelValue | null) =>
      v ? setStoreLevel(v.pitch, v.roll) : setStoreLevel(null, null),
    [setStoreLevel],
  );
  const { available, value: level } = useSensorSubscription<LevelValue>(LevelService, publishLevel);
  const display = level ?? { pitch: 0, roll: 0 };

  return (
    <Screen>
      <Card className="items-center gap-5 py-8">
        <View className="border-primary/60 bg-primary/10 h-40 w-full items-center justify-center rounded-lg border">
          <View className="bg-primary h-8 w-8 rounded-full" />
        </View>
        <Text>Pitch: {display.pitch.toFixed(1)}°</Text>
        <Text>Roll: {display.roll.toFixed(1)}°</Text>
        {available === false ? <Text variant="muted">Accelerometer is not available.</Text> : null}
      </Card>
    </Screen>
  );
}
