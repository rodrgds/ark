import { Accelerometer } from 'expo-sensors';
import { reducedInterval } from '@/constants/battery';
import type { SensorStartOptions } from '@/types/sensors';

export type LevelReading = {
  pitch: number;
  roll: number;
  mode: 'flat' | 'upright';
  tubeAngle: number;
  tubeAxis: 'portrait' | 'landscape';
};

export function calculateLevelReading(input: { x: number; y: number; z: number }): LevelReading {
  const pitch =
    Math.atan2(-input.y, Math.sqrt(input.x * input.x + input.z * input.z)) * (180 / Math.PI);
  const roll =
    Math.atan2(input.x, Math.sqrt(input.y * input.y + input.z * input.z)) * (180 / Math.PI);
  const upright = Math.abs(input.z) < 0.55;
  const tubeAxis = Math.abs(input.y) >= Math.abs(input.x) ? 'portrait' : 'landscape';
  const tubeAngle = tubeAxis === 'portrait' ? roll : pitch;
  return {
    pitch,
    roll,
    mode: upright ? 'upright' : 'flat',
    tubeAngle,
    tubeAxis,
  };
}

export class LevelService {
  static async isAvailable() {
    return Accelerometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (value: LevelReading) => void, options?: SensorStartOptions) {
    Accelerometer.setUpdateInterval(reducedInterval('level', options?.reduceModeEnabled));
    let smoothX = 0;
    let smoothY = 0;
    let smoothZ = 0;
    let initialized = false;

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (!initialized) {
        smoothX = x;
        smoothY = y;
        smoothZ = z;
        initialized = true;
      } else {
        const alpha = 0.42;
        smoothX += (x - smoothX) * alpha;
        smoothY += (y - smoothY) * alpha;
        smoothZ += (z - smoothZ) * alpha;
      }

      listener(calculateLevelReading({ x: smoothX, y: smoothY, z: smoothZ }));
    });
    return () => subscription.remove();
  }
}
