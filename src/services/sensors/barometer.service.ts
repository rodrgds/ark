import { Barometer } from 'expo-sensors';
import { reducedInterval } from '@/constants/battery';
import { SensorsRepository } from '@/services/db/repositories/sensors.repo';
import type { SensorStartOptions } from '@/types/sensors';

export class BarometerService {
  static async isAvailable() {
    return Barometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (pressure: number) => void, options?: SensorStartOptions) {
    Barometer.setUpdateInterval(reducedInterval('barometer', options?.reduceModeEnabled));
    const subscription = Barometer.addListener(({ pressure }) => {
      listener(pressure);
    });
    return () => subscription.remove();
  }

  static saveSnapshot(pressure: number) {
    return SensorsRepository.saveSnapshot('barometer', { pressure });
  }
}
