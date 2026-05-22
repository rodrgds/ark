import { LightSensor } from 'expo-sensors';

export class LightMeterService {
  static async isAvailable() {
    return LightSensor.isAvailableAsync().catch(() => false);
  }

  static start(listener: (lux: number) => void) {
    LightSensor.setUpdateInterval(1000);
    const subscription = LightSensor.addListener(({ illuminance }) => listener(illuminance));
    return () => subscription.remove();
  }
}
