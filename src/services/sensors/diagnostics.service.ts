import * as Location from 'expo-location';
import { SQLCIPHER_ACTIVE } from '@/services/db/schema';
import { CompassService } from '@/services/sensors/compass.service';
import { BarometerService } from '@/services/sensors/barometer.service';
import { LevelService } from '@/services/sensors/level.service';
import { PedometerService } from '@/services/sensors/pedometer.service';
import { LightMeterService } from '@/services/sensors/light.service';
import { NetworkService } from '@/services/connectivity/network.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import type { DiagnosticReport } from '@/types/sensors';

export class DiagnosticsService {
  static async getReport(): Promise<DiagnosticReport> {
    const [compass, barometer, level, pedometer, light, locationPermission, network, storage] =
      await Promise.all([
        CompassService.isAvailable(),
        BarometerService.isAvailable(),
        LevelService.isAvailable(),
        PedometerService.isAvailable(),
        LightMeterService.isAvailable(),
        Location.getForegroundPermissionsAsync().catch(() => ({ granted: false })),
        NetworkService.getState().catch(() => null),
        FileSystemService.getStorageSummary(),
      ]);

    return {
      sensors: {
        compass,
        barometer,
        level,
        pedometer,
        light,
        location: !!locationPermission.granted,
      },
      network: NetworkService.label(network),
      directories: storage.directories,
      sqlCipherActive: SQLCIPHER_ACTIVE,
      ftsAvailable: true,
      aiAdapter: 'mock',
    };
  }
}
