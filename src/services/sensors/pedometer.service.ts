import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

export class PedometerService {
  static async requestPermission(): Promise<boolean> {
    const { status } = await Pedometer.requestPermissionsAsync();
    return status === 'granted';
  }

  static async isAvailable(): Promise<boolean> {
    return Pedometer.isAvailableAsync().catch(() => false);
  }

  static async getTodaySteps(): Promise<{ steps: number }> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Pedometer.getStepCountAsync(start, new Date()).catch(() => ({ steps: 0 }));
  }

  static start(onUpdate: (sessionSteps: number) => void): () => void {
    let baseline: number | null = null;
    let lastEmitted = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const subscription = Pedometer.watchStepCount(({ steps }) => {
      if (baseline === null) {
        baseline = steps;
        onUpdate(0);
        return;
      }
      const delta = steps - baseline;
      lastEmitted = delta;
      onUpdate(delta);
    });

    // Android: watchStepCount fires lazily — poll getStepCountAsync every 2s
    // to get immediate feedback without waiting for the next sensor event.
    if (Platform.OS === 'android') {
      const sessionStart = new Date();

      pollTimer = setInterval(async () => {
        try {
          const now = new Date();
          const result = await Pedometer.getStepCountAsync(sessionStart, now);
          const delta = result.steps;
          if (delta !== lastEmitted) {
            lastEmitted = delta;
            onUpdate(delta);
          }
        } catch {
          // sensor not ready yet, ignore
        }
      }, 2000);
    }

    return () => {
      subscription.remove();
      if (pollTimer) clearInterval(pollTimer);
    };
  }
}