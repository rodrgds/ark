import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemService } from '@/services/files/filesystem.service';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { RagService } from '@/services/ai/rag.service';
import { AUTHORED_GUIDES } from '@/services/content/authored-guides';
import { utf8ByteLength } from '@/lib/format';

async function sha256(value: string) {
  const algorithm = Crypto.CryptoDigestAlgorithm.SHA256 ?? 'SHA-256';
  if (typeof Crypto.digestStringAsync === 'function') {
    return Crypto.digestStringAsync(algorithm, value);
  }
  const digest = await Crypto.digest(algorithm, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class AuthoredGuideSeedService {
  static async seed() {
    const contentDir = FileSystemService.dir('content');
    await FileSystem.makeDirectoryAsync(contentDir, { intermediates: true }).catch(() => undefined);
    const existingPacks = await ContentRepository.list({ includeTestOnly: true });

    for (const [id, guide] of Object.entries(AUTHORED_GUIDES)) {
      const ext = guide.format === 'markdown' ? 'md' : 'html';
      const fileName = `${id}.${ext}`;
      const localUri = `${contentDir}${fileName}`;
      const sizeBytes = utf8ByteLength(guide.content);
      const contentSha256 = await sha256(guide.content);
      const existing = existingPacks.find((pack) => pack.id === id);
      const contentChanged = !existing?.checksumSha256 || existing.checksumSha256 !== contentSha256;
      const metadataChanged =
        existing?.installed !== true ||
        existing.localUri !== localUri ||
        existing.sizeBytes !== sizeBytes ||
        existing.title !== guide.title ||
        existing.description !== guide.description ||
        existing.category !== guide.category ||
        existing.format !== guide.format;

      if (contentChanged || metadataChanged) {
        await FileSystem.writeAsStringAsync(localUri, guide.content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await ContentRepository.createPack({
          id,
          title: guide.title,
          description: guide.description,
          category: guide.category,
          format: guide.format,
          localUri,
          sizeBytes,
          checksumSha256: contentSha256,
          installed: true,
          installStatus: 'installed',
          progress: 1,
        });
      }

      if (contentChanged) {
        await RagService.removeSourcesByRef(id).catch(() => undefined);
        await RagService.indexContentPack(id).catch(() => undefined);
      }
    }
  }
}
