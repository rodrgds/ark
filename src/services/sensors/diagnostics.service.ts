import * as Location from 'expo-location';
import { DATABASE_ENCRYPTION_STATE, SQLCIPHER_ACTIVE } from '@/services/db/schema';
import { DatabaseClient } from '@/services/db/client';
import { DatabaseEncryptionService } from '@/services/db/encryption.service';
import { CompassService } from '@/services/sensors/compass.service';
import { BarometerService } from '@/services/sensors/barometer.service';
import { LevelService } from '@/services/sensors/level.service';
import { PedometerService } from '@/services/sensors/pedometer.service';
import { LightMeterService } from '@/services/sensors/light.service';
import { NetworkService } from '@/services/connectivity/network.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { OfflineRoutingService } from '@/services/maps/offline-routing.service';
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
      ftsAvailable,
      modelStatus,
      routingEngineStatus,
      routingDataStatus,
    ] = await Promise.all([
      CompassService.isAvailable(),
      BarometerService.isAvailable(),
      LevelService.isAvailable(),
      PedometerService.isAvailable(),
      LightMeterService.isAvailable(),
      Location.getForegroundPermissionsAsync().catch(() => ({ granted: false })),
      NetworkService.getState().catch(() => null),
      FileSystemService.getStorageSummary(),
      DatabaseEncryptionService.getRuntimeStatus(SQLCIPHER_ACTIVE, DATABASE_ENCRYPTION_STATE),
      isFts5Available(),
      ModelManagerService.getStatus(),
      OfflineRoutingService.getEngineStatus().catch(() => ({
        available: false,
        engine: 'valhalla',
        reason: 'Unable to query the routing engine.',
      })),
      OfflineRoutingService.getRoutingDataStatus().catch(() => ({
        readyCount: 0,
        readyRegionNames: [],
        downloadingCount: 0,
        failedCount: 0,
        missingGraphCount: 0,
        message: 'Unable to inspect offline navigation data.',
      })),
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
      sqlCipherActive: databaseEncryption.active,
      databaseEncryption,
      ftsAvailable,
      aiAdapter: modelStatus.adapter,
      aiStatusMessage: modelStatus.message,
      routingEngine: routingEngineStatus,
      routingData: routingDataStatus,
    };
  }
}

async function isFts5Available() {
  try {
    const db = await DatabaseClient.getDb();
    const compileOption = await db
      .getFirstAsync<{
        available: number | string | null;
      }>("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS available")
      .catch(() => null);
    if (Number(compileOption?.available ?? 0) === 1) return true;

    await db.execAsync(
      'CREATE VIRTUAL TABLE temp.ark_fts_probe USING fts5(content); DROP TABLE temp.ark_fts_probe;'
    );
    return true;
  } catch {
    return false;
  }
}
