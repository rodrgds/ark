import { Barometer } from 'expo-sensors';
import { SensorsRepository } from '@/services/db/repositories/sensors.repo';

export class BarometerService {
  static async isAvailable() {
    return Barometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (pressure: number) => void) {
    Barometer.setUpdateInterval(1000);
    const subscription = Barometer.addListener(({ pressure }) => {
      listener(pressure);
    });
    return () => subscription.remove();
  }

  static saveSnapshot(pressure: number) {
    return SensorsRepository.saveSnapshot('barometer', { pressure });
  }
}
