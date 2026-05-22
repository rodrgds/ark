import { ContentRepository } from '@/services/db/repositories/content.repo';
import { DownloadManagerService } from '@/services/files/download-manager.service';

export class ContentPackService {
  static listPacks() {
    return ContentRepository.list();
  }

  static async installMockPack(id: string, title: string) {
    await DownloadManagerService.queueMockDownload({ kind: 'guide', title, packId: id });
  }
}
