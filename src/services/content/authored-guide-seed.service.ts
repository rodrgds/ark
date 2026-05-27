import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemService } from '@/services/files/filesystem.service';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { RagService } from '@/services/ai/rag.service';
import { AUTHORED_GUIDES } from '@/services/content/authored-guides';

function utf8ByteLength(str: string): number {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) {
      length += 1;
    } else if (code <= 0x7ff) {
      length += 2;
    } else if (code >= 0xd800 && code <= 0xdfff) {
      length += 4;
      i++;
    } else {
      length += 3;
    }
  }
  return length;
}

export class AuthoredGuideSeedService {
  static async seed() {
    const contentDir = FileSystemService.dir('content');
    await FileSystem.makeDirectoryAsync(contentDir, { intermediates: true }).catch(() => undefined);
    const existingPacks = await ContentRepository.list({ includeTestOnly: true });

    for (const [id, guide] of Object.entries(AUTHORED_GUIDES)) {
      const fileName = `${id}.html`;
      const localUri = `${contentDir}${fileName}`;
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        await FileSystem.writeAsStringAsync(localUri, guide.html, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const sizeBytes = utf8ByteLength(guide.html);
      const existing = existingPacks.find((pack) => pack.id === id);
      const unchanged =
        existing?.installed &&
        existing.installStatus === 'installed' &&
        existing.localUri === localUri &&
        existing.sizeBytes === sizeBytes &&
        existing.title === guide.title &&
        existing.description === guide.description &&
        existing.category === guide.category &&
        existing.format === 'html';

      if (!unchanged) {
        await ContentRepository.createPack({
          id,
          title: guide.title,
          description: guide.description,
          category: guide.category,
          format: 'html',
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
