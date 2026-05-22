import { Magnetometer } from 'expo-sensors';

export class CompassService {
  static async isAvailable() {
    return Magnetometer.isAvailableAsync().catch(() => false);
  }

  static start(listener: (heading: number) => void) {
    Magnetometer.setUpdateInterval(500);
    const subscription = Magnetometer.addListener(({ x, y }) => {
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      listener((angle + 360) % 360);
    });
    return () => subscription.remove();
  }

  static cardinal(heading: number) {
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return points[Math.round(heading / 45) % 8];
  }
}
