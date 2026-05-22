import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { PedometerService } from '@/services/sensors/pedometer.service';
import * as React from 'react';

export default function PedometerTool() {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [today, setToday] = React.useState(0);
  const [session, setSession] = React.useState(0);

  React.useEffect(() => {
    let stop: undefined | (() => void);
    PedometerService.isAvailable().then(async (ok) => {
      setAvailable(ok);
      if (ok) {
        setToday((await PedometerService.getTodaySteps()).steps);
        stop = PedometerService.start(setSession);
      }
    });
    return () => stop?.();
  }, []);

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
