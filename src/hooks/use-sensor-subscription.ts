import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import { circularSpreadDeg } from '@/lib/compass-stability';
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

type StabilitySample = { heading: number; t: number };

export function useHeadingStability(
  heading: number | null,
  options: { windowMs?: number; thresholdDeg?: number; minSamples?: number } = {}
): { stable: boolean | null; spreadDeg: number | null } {
  const { windowMs = 6_000, thresholdDeg = 30, minSamples = 12 } = options;
  const samplesRef = React.useRef<StabilitySample[]>([]);

  return React.useMemo(() => {
    if (heading === null) {
      samplesRef.current = [];
      return { stable: null, spreadDeg: null };
    }
    const now = Date.now();
    const next = samplesRef.current.filter((sample) => now - sample.t <= windowMs);
    next.push({ heading, t: now });
    samplesRef.current = next;

    if (next.length < minSamples) {
      return { stable: null, spreadDeg: null };
    }

    const spread = circularSpreadDeg(next.map((sample) => sample.heading));
    return { stable: spread <= thresholdDeg, spreadDeg: spread };
  }, [heading, minSamples, thresholdDeg, windowMs]);
}
