import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { HapticsService } from '@/services/device/haptics.service';
import { BarometerService } from '@/services/sensors/barometer.service';
import { PressureTrendService } from '@/services/weather/pressure-trend.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';

export default function BarometerTool() {
  const [trend, setTrend] = React.useState<'rising' | 'stable' | 'falling'>('stable');
  const setStorePressure = useSensorStore((state) => state.setPressure);
  const { available, value: pressure } = useSensorSubscription(BarometerService, setStorePressure);

  React.useEffect(() => {
    PressureTrendService.computeTrend().then(setTrend);
  }, [pressure]);

  async function snapshot() {
    if (pressure !== null) {
      await BarometerService.saveSnapshot(pressure);
      void HapticsService.success();
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
