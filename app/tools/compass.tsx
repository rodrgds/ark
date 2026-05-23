import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { CompassService } from '@/services/sensors/compass.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';

export default function CompassTool() {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [heading, setHeading] = React.useState<number | null>(null);
  const setStoreHeading = useSensorStore((state) => state.setHeading);

  React.useEffect(() => {
    let stop: undefined | (() => void);
    CompassService.isAvailable().then((ok) => {
      setAvailable(ok);
      if (ok)
        stop = CompassService.start((nextHeading) => {
          setHeading(nextHeading);
          setStoreHeading(nextHeading);
        });
    });
    return () => {
      stop?.();
      setStoreHeading(null);
    };
  }, [setStoreHeading]);

  return (
    <Screen>
      <Card className="items-center gap-4 py-8">
        <Text variant="h2">{heading === null ? '--' : `${Math.round(heading)}°`}</Text>
        <Text className="text-primary text-5xl font-bold">
          {heading === null ? '-' : CompassService.cardinal(heading)}
        </Text>
        <Text variant="muted">
          {available === false
            ? 'Magnetometer is not available in this build/device.'
            : 'Move in a figure-eight pattern if readings drift.'}
        </Text>
      </Card>
    </Screen>
  );
}
