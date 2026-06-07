import { Magnetometer } from 'expo-sensors';
import { reducedInterval } from '@/constants/battery';
import type { SensorStartOptions } from '@/types/sensors';

export type CompassReading = {
  heading: number;
  x: number;
  y: number;
  z: number;
  fieldStrength: number;
};

export function calculateCompassReading(input: {
  x: number;
  y: number;
  z: number;
}): CompassReading {
  const heading = Math.atan2(-input.x, input.y) * (180 / Math.PI);
  return {
    heading: (heading + 360) % 360,
    x: input.x,
    y: input.y,
    z: input.z,
    fieldStrength: Math.sqrt(input.x * input.x + input.y * input.y + input.z * input.z),
  };
}

type Listener = (reading: CompassReading) => void;

const listeners = new Set<Listener>();
let nativeSubscription: { remove: () => void } | null = null;
let lastReduceMode: boolean | undefined;

function ensureNativeSubscription(reduceModeEnabled: boolean | undefined) {
  if (nativeSubscription && reduceModeEnabled === lastReduceMode) return;
  if (nativeSubscription) {
    nativeSubscription.remove();
    nativeSubscription = null;
  }
  Magnetometer.setUpdateInterval(reducedInterval('compass', reduceModeEnabled));
  nativeSubscription = Magnetometer.addListener((reading) => {
    const payload = calculateCompassReading(reading);
    for (const listener of listeners) listener(payload);
  });
  lastReduceMode = reduceModeEnabled;
}

function dropNativeSubscriptionIfIdle() {
  if (listeners.size > 0) return;
  nativeSubscription?.remove();
  nativeSubscription = null;
  lastReduceMode = undefined;
}

export class CompassService {
  static async isAvailable() {
    return Magnetometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (heading: number) => void, options?: SensorStartOptions) {
    return this.startReading((reading) => listener(reading.heading), options);
  }

  static startReading(listener: (reading: CompassReading) => void, options?: SensorStartOptions) {
    ensureNativeSubscription(options?.reduceModeEnabled);
    listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
      dropNativeSubscriptionIfIdle();
    };
  }

  static cardinal(heading: number) {
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return points[Math.round(heading / 45) % 8];
  }
}
