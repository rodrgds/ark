import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { LevelService } from '@/services/sensors/level.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';
import { View } from 'react-native';

export default function LevelTool() {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [level, setLevel] = React.useState({ pitch: 0, roll: 0 });
  const setStoreLevel = useSensorStore((state) => state.setLevel);

  React.useEffect(() => {
    let stop: undefined | (() => void);
    LevelService.isAvailable().then((ok) => {
      setAvailable(ok);
      if (ok)
        stop = LevelService.start((nextLevel) => {
          setLevel(nextLevel);
          setStoreLevel(nextLevel.pitch, nextLevel.roll);
        });
    });
    return () => {
      stop?.();
      setStoreLevel(null, null);
    };
  }, [setStoreLevel]);

  return (
    <Screen>
      <Card className="items-center gap-5 py-8">
        <View className="border-primary/60 bg-primary/10 h-40 w-full items-center justify-center rounded-lg border">
          <View className="bg-primary h-8 w-8 rounded-full" />
        </View>
        <Text>Pitch: {level.pitch.toFixed(1)}°</Text>
        <Text>Roll: {level.roll.toFixed(1)}°</Text>
        {available === false ? <Text variant="muted">Accelerometer is not available.</Text> : null}
      </Card>
    </Screen>
  );
}
