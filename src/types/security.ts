export type VaultUnlockResult = {
  ok: boolean;
  reason?: string;
  lockedUntil?: number | null;
};

export type BiometricsStatus = {
  available: boolean;
  enrolled: boolean;
};
