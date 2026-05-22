import { create } from 'zustand';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import type { DownloadRow } from '@/types/downloads';

type DownloadState = {
  downloads: DownloadRow[];
  load: () => Promise<void>;
};

export const useDownloadStore = create<DownloadState>((set) => ({
  downloads: [],
  load: async () => set({ downloads: await DownloadManagerService.listDownloads() }),
}));
