import type { AiRuntimeAdapter } from '@/types/ai';

type SensorAvailability = {
  compass: boolean;
  barometer: boolean;
  level: boolean;
  pedometer: boolean;
  light: boolean;
  location: boolean;
};

export type SensorStartOptions = {
  reduceModeEnabled?: boolean;
};

export type DiagnosticReport = {
  sensors: SensorAvailability;
  network: string;
  directories: Record<string, string>;
  sqlCipherActive: boolean;
  databaseEncryption: {
    active: boolean;
    runtimeActive: boolean;
    databaseState: 'unknown' | 'encrypted' | 'plaintext' | 'unenforced';
    stateLabel: string;
    encryptionEnabled: boolean;
    keyStored: boolean;
    keyStrategy: string;
    migrationStatus: string;
    existingDataStatus: string;
    passphraseRekeyStatus: string;
    plaintextMigrationImplemented: boolean;
    vaultPassphraseRekeyImplemented: boolean;
    note: string;
  };
  ftsAvailable: boolean;
  aiAdapter: AiRuntimeAdapter;
  aiStatusMessage: string;
  routingEngine: {
    available: boolean;
    engine: string;
    reason?: string;
  };
  routingData: {
    readyCount: number;
    readyRegionNames: string[];
    downloadingCount: number;
    failedCount: number;
    missingGraphCount: number;
    message: string;
  };
};
