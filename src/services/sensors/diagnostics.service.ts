import * as Location from 'expo-location';
import { SQLCIPHER_ACTIVE } from '@/services/db/schema';
import { DatabaseEncryptionService } from '@/services/db/encryption.service';
import { CompassService } from '@/services/sensors/compass.service';
import { BarometerService } from '@/services/sensors/barometer.service';
import { LevelService } from '@/services/sensors/level.service';
import { PedometerService } from '@/services/sensors/pedometer.service';
import { LightMeterService } from '@/services/sensors/light.service';
import { NetworkService } from '@/services/connectivity/network.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import type { DiagnosticReport } from '@/types/sensors';

export class DiagnosticsService {
  static async getReport(): Promise<DiagnosticReport> {
    const [
      compass,
      barometer,
      level,
      pedometer,
      light,
      locationPermission,
      network,
      storage,
      databaseEncryption,
      modelStatus,
    ] = await Promise.all([
      CompassService.isAvailable(),
      BarometerService.isAvailable(),
      LevelService.isAvailable(),
      PedometerService.isAvailable(),
      LightMeterService.isAvailable(),
      Location.getForegroundPermissionsAsync().catch(() => ({ granted: false })),
      NetworkService.getState().catch(() => null),
      FileSystemService.getStorageSummary(),
      DatabaseEncryptionService.getRuntimeStatus(SQLCIPHER_ACTIVE),
      ModelManagerService.getStatus(),
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
      databaseEncryption,
      ftsAvailable: true,
      aiAdapter: modelStatus.adapter === 'llama' ? 'llama' : 'mock',
      aiStatusMessage: modelStatus.message,
    };
  }
}
