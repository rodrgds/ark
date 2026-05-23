import { Accelerometer } from 'expo-sensors';

export class LevelService {
  static async isAvailable() {
    return Accelerometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (value: { pitch: number; roll: number }) => void) {
    Accelerometer.setUpdateInterval(60);
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

      const pitch =
        Math.atan2(-smoothY, Math.sqrt(smoothX * smoothX + smoothZ * smoothZ)) * (180 / Math.PI);
      const roll =
        Math.atan2(smoothX, Math.sqrt(smoothY * smoothY + smoothZ * smoothZ)) * (180 / Math.PI);
      listener({ pitch, roll });
    });
    return () => subscription.remove();
  }
}
