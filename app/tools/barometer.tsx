import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { BarometerService } from '@/services/sensors/barometer.service';
import { PressureTrendService } from '@/services/weather/pressure-trend.service';
import * as React from 'react';

export default function BarometerTool() {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [pressure, setPressure] = React.useState<number | null>(null);
  const [trend, setTrend] = React.useState<'rising' | 'stable' | 'falling'>('stable');

  React.useEffect(() => {
    let stop: undefined | (() => void);
    BarometerService.isAvailable().then((ok) => {
      setAvailable(ok);
      if (ok) stop = BarometerService.start(setPressure);
    });
    PressureTrendService.computeTrend().then(setTrend);
    return () => stop?.();
  }, []);

  async function snapshot() {
    if (pressure !== null) {
      await BarometerService.saveSnapshot(pressure);
      setTrend(await PressureTrendService.computeTrend());
    }
  }

  return (
    <Screen>
      <Card className="items-center gap-4 py-8">
        <Text variant="h2">{pressure === null ? '--' : pressure.toFixed(1)}</Text>
        <Text className="text-primary text-xl font-semibold">hPa</Text>
        <Text>Trend: {trend}</Text>
        <Text variant="muted">
          {available === false
            ? 'Barometer is not available.'
            : 'Rough local trend signal, not a full weather forecast.'}
        </Text>
        <Button onPress={snapshot} disabled={pressure === null}>
          <Text>Save snapshot</Text>
        </Button>
      </Card>
    </Screen>
  );
}
