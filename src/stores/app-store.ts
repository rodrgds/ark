import { create } from 'zustand';
import { DatabaseClient } from '@/services/db/client';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { AuthoredGuideSeedService } from '@/services/content/authored-guide-seed.service';
import { useThemeStore } from '@/stores/theme-store';
import type { OnboardingState, VaultState } from '@/types/db';

type AppState = {
  booted: boolean;
  onboarding: OnboardingState | null;
  vault: VaultState | null;
  error: string | null;
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  onboarding: null,
  vault: null,
  error: null,
  boot: async () => {
    try {
      await DatabaseClient.getDb();
      await FileSystemService.ensureAppDirectories();
      await ContentRepository.seedStarterPacks();
      await AuthoredGuideSeedService.seed();
      await DownloadManagerService.recoverPendingDownloads();
      await useThemeStore.getState().init();
      const [onboarding, vault] = await Promise.all([
        SettingsRepository.getOnboardingState(),
        SettingsRepository.getVaultState(),
      ]);
      set({ booted: true, onboarding, vault, error: null });
    } catch (error) {
      set({ booted: true, error: error instanceof Error ? error.message : String(error) });
    }
  },
  refresh: async () => {
    const [onboarding, vault] = await Promise.all([
      SettingsRepository.getOnboardingState(),
      SettingsRepository.getVaultState(),
    ]);
    set({ onboarding, vault });
  },
  completeOnboarding: async () => {
    await SettingsRepository.updateOnboardingState({
      hasSeenIntro: true,
      hasCreatedVault: true,
      completedAt: Date.now(),
    });
    await get().refresh();
  },
}));
