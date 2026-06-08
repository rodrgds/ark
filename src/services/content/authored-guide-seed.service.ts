import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemService } from '@/services/files/filesystem.service';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { RagService } from '@/services/ai/rag.service';
import { AUTHORED_GUIDES } from '@/services/content/authored-guides';
import { utf8ByteLength } from '@/lib/format';

export class AuthoredGuideSeedService {
  static async seed() {
    const contentDir = FileSystemService.dir('content');
    await FileSystem.makeDirectoryAsync(contentDir, { intermediates: true }).catch(() => undefined);
    const existingPacks = await ContentRepository.list({ includeTestOnly: true });

    for (const [id, guide] of Object.entries(AUTHORED_GUIDES)) {
      const ext = guide.format === 'markdown' ? 'md' : 'html';
      const fileName = `${id}.${ext}`;
      const localUri = `${contentDir}${fileName}`;
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        await FileSystem.writeAsStringAsync(localUri, guide.content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const sizeBytes = utf8ByteLength(guide.content);
      const existing = existingPacks.find((pack) => pack.id === id);
      const unchanged =
        existing?.installed &&
        existing.installStatus === 'installed' &&
        existing.localUri === localUri &&
        existing.sizeBytes === sizeBytes &&
        existing.title === guide.title &&
        existing.description === guide.description &&
        existing.category === guide.category &&
        existing.format === guide.format;

      if (!unchanged) {
        await ContentRepository.createPack({
          id,
          title: guide.title,
          description: guide.description,
          category: guide.category,
          format: guide.format,
          localUri,
          sizeBytes,
          installed: true,
          installStatus: 'installed',
          progress: 1,
        });
      }

      await RagService.indexContentPack(id).catch(() => undefined);
    }
  }
}
