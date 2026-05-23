export type OnboardingState = {
  id: 'main';
  hasSeenIntro: boolean;
  hasCreatedVault: boolean;
  hasConfiguredBiometrics: boolean;
  hasSelectedPacks: boolean;
  completedAt: number | null;
};

export type VaultState = {
  id: 'main';
  isInitialized: boolean;
  passwordHint: string | null;
  kdfSalt: string | null;
  createdAt: number;
  updatedAt: number;
  lastUnlockedAt: number | null;
  autoLockMinutes: number;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type ArkDocument = {
  id: string;
  title: string;
  mimeType: string | null;
  localUri: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  source: string | null;
  isPersonal: boolean;
  encryptionStatus: 'unknown' | 'plaintext' | 'encrypted';
  createdAt: number;
  updatedAt: number;
};
