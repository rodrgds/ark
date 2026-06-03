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

export class CompassService {
  static async isAvailable() {
    return Magnetometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (heading: number) => void, options?: SensorStartOptions) {
    return this.startReading((reading) => listener(reading.heading), options);
  }

  static startReading(listener: (reading: CompassReading) => void, options?: SensorStartOptions) {
    Magnetometer.setUpdateInterval(reducedInterval('compass', options?.reduceModeEnabled));
    const subscription = Magnetometer.addListener((reading) =>
      listener(calculateCompassReading(reading))
    );
    return () => subscription.remove();
  }

  static cardinal(heading: number) {
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return points[Math.round(heading / 45) % 8];
  }
}
