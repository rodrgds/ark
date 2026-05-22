import { Pedometer } from 'expo-sensors';

export class PedometerService {
  static async isAvailable() {
    return Pedometer.isAvailableAsync().catch(() => false);
  }

  static async getTodaySteps() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Pedometer.getStepCountAsync(start, new Date()).catch(() => ({ steps: 0 }));
  }

  static start(listener: (steps: number) => void) {
    const subscription = Pedometer.watchStepCount(({ steps }) => listener(steps));
    return () => subscription.remove();
  }
}
