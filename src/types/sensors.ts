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
    keyStored: boolean;
    keyStrategy: string;
    migrationStatus: string;
    note: string;
  };
  ftsAvailable: boolean;
  aiAdapter: 'mock' | 'llama-unavailable' | 'llama';
  aiStatusMessage: string;
};
