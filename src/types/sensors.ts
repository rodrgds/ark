export type SensorAvailability = {
  compass: boolean;
  barometer: boolean;
  level: boolean;
  pedometer: boolean;
  light: boolean;
  location: boolean;
};

export type DiagnosticReport = {
  sensors: SensorAvailability;
  network: string;
  directories: Record<string, string>;
  sqlCipherActive: boolean;
  ftsAvailable: boolean;
  aiAdapter: 'mock' | 'llama-unavailable' | 'llama';
};
