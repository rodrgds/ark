import * as React from 'react';

type SensorService<T> = {
  isAvailable(): Promise<boolean>;
  start(cb: (value: T) => void): (() => void) | undefined;
};

export function useSensorSubscription<T>(
  service: SensorService<T>,
  storeSetter: (value: T | null) => void,
): { available: boolean | null; value: T | null } {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [value, setValue] = React.useState<T | null>(null);

  React.useEffect(() => {
    let stop: (() => void) | undefined;
    service.isAvailable().then((ok) => {
      setAvailable(ok);
      if (ok) {
        stop = service.start((next) => {
          setValue(next);
          storeSetter(next);
        });
      }
    });
    return () => {
      stop?.();
      storeSetter(null);
    };
  }, []);

  return { available, value };
}
