import { create } from 'zustand';
import { DatabaseClient } from '@/services/db/client';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { AuthoredGuideSeedService } from '@/services/content/authored-guide-seed.service';
import { MapService } from '@/services/maps/map.service';
import { useThemeStore } from '@/stores/theme-store';
import type { OnboardingState, VaultState } from '@/types/db';

type AppState = {
  booting: boolean;
  booted: boolean;
  bootProgress: number;
  bootStatus: string;
  onboarding: OnboardingState | null;
  vault: VaultState | null;
  error: string | null;
  boot: () => Promise<void>;
  retryBoot: () => Promise<void>;
  refresh: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

let bootPromise: Promise<void> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  booting: false,
  booted: false,
  bootProgress: 0,
  bootStatus: 'Preparing offline systems...',
  onboarding: null,
  vault: null,
  error: null,
  boot: async () => {
    if (bootPromise) return bootPromise;
    bootPromise = runBoot(set, get, false);
    try {
      await bootPromise;
    } finally {
      bootPromise = null;
    }
  },
  retryBoot: async () => {
    if (get().booting) return;
    bootPromise = runBoot(set, get, true);
    try {
      await bootPromise;
    } finally {
      bootPromise = null;
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

async function runBoot(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  isRetry: boolean
) {
  set({
    booting: true,
    booted: false,
    error: null,
    bootProgress: 0,
    bootStatus: isRetry ? 'Retrying offline systems...' : 'Preparing offline systems...',
  });
  try {
    set({ bootProgress: 0.08, bootStatus: 'Opening encrypted database and migrations' });
    await DatabaseClient.getDb();
    set({ bootProgress: 0.26, bootStatus: 'Preparing folders' });
    await FileSystemService.ensureAppDirectories();
    set({ bootProgress: 0.42, bootStatus: 'Loading settings and content catalog' });
    await ContentRepository.seedStarterPacks();
    set({
      bootProgress: 0.58,
      bootStatus: 'Checking built-in guides for offline reading and search',
    });
    await AuthoredGuideSeedService.seed();
    set({ bootProgress: 0.72, bootStatus: 'Recovering paused and queued downloads' });
    await DownloadManagerService.recoverPendingDownloads();
    set({ bootProgress: 0.82, bootStatus: 'Checking native map support' });
    await MapService.loadMapLibre().catch(() => undefined);
    set({ bootProgress: 0.84, bootStatus: 'Loading theme and vault state' });
    await useThemeStore.getState().init();
    const [onboarding, vault] = await Promise.all([
      SettingsRepository.getOnboardingState(),
      SettingsRepository.getVaultState(),
    ]);
    set({
      bootProgress: 1,
      bootStatus: 'Ready',
      booting: false,
      booted: true,
      onboarding,
      vault,
      error: null,
    });
  } catch (error) {
    set({
      booting: false,
      booted: false,
      error: error instanceof Error ? error.message : String(error),
    });
    void get;
  }
}
