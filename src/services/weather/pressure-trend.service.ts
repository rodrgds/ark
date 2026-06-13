import { SensorsRepository } from '@/services/db/repositories/sensors.repo';

const TREND_WINDOW_MS = 3 * 60 * 60 * 1000;
const TREND_THRESHOLD_HPA = 1;

export class PressureTrendService {
  static async computeTrend() {
    const now = Date.now();
    const windowStart = now - TREND_WINDOW_MS;
    const snapshots = await SensorsRepository.listSnapshots('barometer', 200);
    const samples = snapshots
      .map((snapshot) => ({
        pressure: (JSON.parse(snapshot.data_json) as { pressure?: number }).pressure ?? null,
        createdAt: snapshot.created_at,
      }))
      .filter(
        (sample): sample is { pressure: number; createdAt: number } =>
          typeof sample.pressure === 'number' && sample.createdAt >= windowStart
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    if (samples.length < 2) return 'stable' as const;
    const delta = samples[samples.length - 1].pressure - samples[0].pressure;
    if (delta > TREND_THRESHOLD_HPA) return 'rising' as const;
    if (delta < -TREND_THRESHOLD_HPA) return 'falling' as const;
    return 'stable' as const;
  }
}
