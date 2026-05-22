import { DownloadsRepository } from '@/services/db/repositories/downloads.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import type { DownloadKind } from '@/types/downloads';

export class DownloadManagerService {
  static async queueMockDownload(input: {
    kind: DownloadKind;
    title: string;
    packId?: string;
    sourceUrl?: string | null;
  }) {
    const id = await DownloadsRepository.create({
      kind: input.kind,
      title: input.title,
      sourceUrl: input.sourceUrl ?? null,
    });
    await DownloadsRepository.updateStatus(id, 'completed', 1);
    if (input.packId) await ContentRepository.setMockInstalled(input.packId);
    return id;
  }

  static listDownloads() {
    return DownloadsRepository.list();
  }
}
