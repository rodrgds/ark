import { SensorsRepository } from '@/services/db/repositories/sensors.repo';

export class PressureTrendService {
  static async computeTrend() {
    const snapshots = await SensorsRepository.listSnapshots('barometer', 8);
    const pressures = snapshots
      .map((snapshot) => JSON.parse(snapshot.data_json) as { pressure?: number })
      .map((data) => data.pressure)
      .filter((value): value is number => typeof value === 'number');
    if (pressures.length < 2) return 'stable' as const;
    const delta = pressures[0] - pressures[pressures.length - 1];
    if (delta > 1.2) return 'rising' as const;
    if (delta < -1.2) return 'falling' as const;
    return 'stable' as const;
  }
}
