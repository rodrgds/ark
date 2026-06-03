import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import * as React from 'react';

type SensorService<T> = {
  isAvailable(): Promise<boolean>;
  start(
    cb: (value: T) => void,
    options?: { reduceModeEnabled?: boolean }
  ): (() => void) | undefined;
};

export function useSensorSubscription<T>(
  service: SensorService<T>,
  storeSetter: (value: T | null) => void
): { available: boolean | null; value: T | null } {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [value, setValue] = React.useState<T | null>(null);
  const reduceModeEnabled = useBatteryReduceMode();

  React.useEffect(() => {
    let stop: (() => void) | undefined;
    let active = true;
    service.isAvailable().then((ok) => {
      if (!active) return;
      setAvailable(ok);
      if (ok) {
        stop = service.start(
          (next) => {
            setValue(next);
            storeSetter(next);
          },
          { reduceModeEnabled }
        );
      }
    });
    return () => {
      active = false;
      stop?.();
      storeSetter(null);
    };
  }, [reduceModeEnabled, service, storeSetter]);

  return { available, value };
}
