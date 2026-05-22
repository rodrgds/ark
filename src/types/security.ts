export type VaultUnlockResult = {
  ok: boolean;
  reason?: string;
};

export type BiometricsStatus = {
  available: boolean;
  enrolled: boolean;
};
