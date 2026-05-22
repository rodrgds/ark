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
