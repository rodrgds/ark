import { LightSensor } from 'expo-sensors';
import { reducedInterval } from '@/constants/battery';
import type { SensorStartOptions } from '@/types/sensors';

export class LightMeterService {
  static async isAvailable() {
    return LightSensor.isAvailableAsync().catch(() => false);
  }

  static start(listener: (lux: number) => void, options?: SensorStartOptions) {
    LightSensor.setUpdateInterval(reducedInterval('light', options?.reduceModeEnabled));
    const subscription = LightSensor.addListener(({ illuminance }) => listener(illuminance));
    return () => subscription.remove();
  }
}
