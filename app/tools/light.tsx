import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { LightMeterService } from '@/services/sensors/light.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';

export default function LightTool() {
  const setStoreLux = useSensorStore((state) => state.setLux);
  const { available, value: lux } = useSensorSubscription(LightMeterService, setStoreLux);

  return (
    <Screen>
      <Card className="items-center gap-4 py-8">
        <Text variant="h2">{lux === null ? '--' : Math.round(lux)}</Text>
        <Text className="text-primary text-xl font-semibold">lux</Text>
        {available === false ? (
          <Text variant="muted">Light sensor is not available on this build/device.</Text>
        ) : null}
      </Card>
    </Screen>
  );
}
