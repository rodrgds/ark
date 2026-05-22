import { Accelerometer } from 'expo-sensors';

export class LevelService {
  static async isAvailable() {
    return Accelerometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (value: { pitch: number; roll: number }) => void) {
    Accelerometer.setUpdateInterval(250);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const pitch = Math.atan2(-x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
      const roll = Math.atan2(y, z) * (180 / Math.PI);
      listener({ pitch, roll });
    });
    return () => subscription.remove();
  }
}
