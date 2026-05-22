import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { LightMeterService } from '@/services/sensors/light.service';
import * as React from 'react';

export default function LightTool() {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [lux, setLux] = React.useState<number | null>(null);

  React.useEffect(() => {
    let stop: undefined | (() => void);
    LightMeterService.isAvailable().then((ok) => {
      setAvailable(ok);
      if (ok) stop = LightMeterService.start(setLux);
    });
    return () => stop?.();
  }, []);

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
