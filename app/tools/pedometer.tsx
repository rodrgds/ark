import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { PedometerService } from '@/services/sensors/pedometer.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';

export default function PedometerTool() {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [today, setToday] = React.useState(0);
  const [session, setSession] = React.useState(0);
  const setStoreSteps = useSensorStore((state) => state.setSteps);

  React.useEffect(() => {
    let stop: undefined | (() => void);
    PedometerService.isAvailable().then(async (ok) => {
      setAvailable(ok);
      if (ok) {
        const todaySteps = (await PedometerService.getTodaySteps()).steps;
        setToday(todaySteps);
        setStoreSteps(todaySteps);
        stop = PedometerService.start((nextSession) => {
          setSession(nextSession);
          setStoreSteps(todaySteps + nextSession);
        });
      }
    });
    return () => {
      stop?.();
      setStoreSteps(null);
    };
  }, [setStoreSteps]);

  return (
    <Screen>
      <Card className="items-center gap-4 py-8">
        <Text variant="h2">{today}</Text>
        <Text className="text-primary text-xl font-semibold">steps today</Text>
        <Text>Session: {session}</Text>
        {available === false ? <Text variant="muted">Pedometer is not available.</Text> : null}
      </Card>
    </Screen>
  );
}
