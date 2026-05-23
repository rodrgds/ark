import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { LightMeterService } from '@/services/sensors/light.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';

export default function LightTool() {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [lux, setLux] = React.useState<number | null>(null);
  const setStoreLux = useSensorStore((state) => state.setLux);

  React.useEffect(() => {
    let stop: undefined | (() => void);
    LightMeterService.isAvailable().then((ok) => {
      setAvailable(ok);
      if (ok)
        stop = LightMeterService.start((nextLux) => {
          setLux(nextLux);
          setStoreLux(nextLux);
        });
    });
    return () => {
      stop?.();
      setStoreLux(null);
    };
  }, [setStoreLux]);

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
