import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { RagService } from '@/services/ai/rag.service';
import { getVoiceProjectorId } from '@/services/ai/voice-models';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { AuthoredGuideSeedService } from '@/services/content/authored-guide-seed.service';
import { contentPackIdSchema, parseOrThrow } from '@/lib/validation';
import { Linking } from 'react-native';
import type { ContentFormat, ContentModelRole } from '@/types/content';

function mimeTypeForFormat(format: ContentFormat) {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'html':
      return 'text/html';
    case 'txt':
    case 'markdown':
      return 'text/plain';
    case 'zim':
      return 'application/zim';
    default:
      return undefined;
  }
}

export class ContentPackService {
  static listPacks() {
    return ContentRepository.list();
  }

  static async getPack(id: string) {
    const packId = parseOrThrow(contentPackIdSchema, id);
    return (await ContentRepository.list()).find((item) => item.id === packId) ?? null;
  }

  static async installPack(id: string) {
    const packId = parseOrThrow(contentPackIdSchema, id);
    const pack = (await ContentRepository.list()).find((item) => item.id === packId);
    if (!pack) throw new Error('Content pack not found.');

    if (!pack.sourceUrl) {
      // If it's a local guide (no source URL), we can re-seed it
      await AuthoredGuideSeedService.seed();
      return;
    }

    await DownloadManagerService.queueDownload({
      kind:
        pack.category === 'AI Models'
          ? 'model'
          : pack.format === 'zim'
            ? 'zim'
            : pack.category === 'Maps'
              ? 'map'
              : 'guide',
      title: pack.title,
      packId: pack.id,
      sourceUrl: pack.sourceUrl,
      fileName: pack.fileName,
      expectedChecksumMd5: pack.checksumMd5,
      expectedChecksumSha256: pack.checksumSha256,
      expectedChecksumSha256Url: pack.checksumSha256Url,
      expectedSizeBytes: pack.sizeBytes,
      snapshotHtml: pack.downloadStrategy === 'html_snapshot',
    });
  }

  static async installPackWithCompanions(id: string) {
    await this.installPack(id);
    const projectorId = getVoiceProjectorId(id);
    if (projectorId) {
      const projector = await this.getPack(projectorId);
      if (
        projector &&
        !projector.installed &&
        !['queued', 'downloading', 'verifying'].includes(projector.installStatus)
      ) {
        await this.installPack(projectorId);
      }
    }
  }

  static async pausePackDownload(id: string) {
    const { pack, download } = await this.findDownloadForPack(id);
    if (!download) throw new Error('No active download was found for this pack.');
    await DownloadManagerService.pauseDownload(download.id);
    await ContentRepository.updateInstallStatus({
      id: pack.id,
      status: 'paused',
      progress: download.progress,
      localUri: pack.localUri ?? download.localUri,
    });
  }

  static async resumePackDownload(id: string) {
    const { pack, download } = await this.findDownloadForPack(id);
    if (pack.format === 'html') {
      await this.installPack(id);
      return;
    }
    if (!download) {
      await this.installPack(id);
      return;
    }
    await ContentRepository.updateInstallStatus({
      id: pack.id,
      status: 'queued',
      progress: pack.progress,
      localUri: pack.localUri ?? download.localUri,
    });
    void DownloadManagerService.resumeDownload(download.id, pack.id);
  }

  static async cancelPackDownload(id: string) {
    const { pack, download } = await this.findDownloadForPack(id);
    if (download) await DownloadManagerService.cancelDownload(download.id);
    if (pack.localUri) {
      const deleteTarget =
        pack.downloadStrategy === 'html_snapshot'
          ? pack.localUri.slice(0, pack.localUri.lastIndexOf('/') + 1)
          : pack.localUri;
      await FileSystem.deleteAsync(deleteTarget, { idempotent: true });
    }
    await ContentRepository.uninstall(pack.id);
  }

  static async openPack(id: string) {
    const packId = parseOrThrow(contentPackIdSchema, id);
    const pack = (await ContentRepository.list()).find((item) => item.id === packId);
    if (!pack?.localUri) throw new Error('Pack is not installed.');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pack.localUri, {
        dialogTitle: pack.format === 'zim' ? 'Open in...' : `Open ${pack.title}`,
        mimeType: mimeTypeForFormat(pack.format),
      });
      return;
    }
    const canOpen = await Linking.canOpenURL(pack.localUri);
    if (!canOpen) throw new Error('No app is available to open this file yet.');
    await Linking.openURL(pack.localUri);
  }

  static async removePack(id: string) {
    const packId = parseOrThrow(contentPackIdSchema, id);
    const pack = (await ContentRepository.list()).find((item) => item.id === packId);
    if (pack?.localUri) {
      const deleteTarget =
        pack.downloadStrategy === 'html_snapshot'
          ? pack.localUri.slice(0, pack.localUri.lastIndexOf('/') + 1)
          : pack.localUri;
      await FileSystemService.deleteByUri(deleteTarget);
    }
    if (
      packId.startsWith('custom-model-') ||
      packId.startsWith('custom-chat-model-') ||
      packId.startsWith('custom-embedding-model-') ||
      packId.startsWith('custom-voice-model-') ||
      packId.startsWith('user-web-')
    ) {
      await ContentRepository.delete(packId);
    } else {
      await ContentRepository.uninstall(packId);
    }
    if (pack?.format === 'zim') {
      await RagService.removeZimPackSources(packId);
    } else {
      await RagService.removeSourcesByRef(packId);
    }
  }

  static async importLocalModel(modelRole: ContentModelRole = 'chat') {
    if (modelRole === 'embedding') {
      throw new Error('Source search uses Ark built-in ExecuTorch embeddings.');
    }
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    if (!asset.name.toLowerCase().endsWith('.gguf')) {
      throw new Error('Select a GGUF model file.');
    }

    const header = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 4,
      position: 0,
    }).catch(() => '');
    if (!isGgufMagicHeader(header)) {
      throw new Error('File is not a valid GGUF model (magic bytes missing).');
    }

    await FileSystemService.ensureAppDirectories();
    const normalizedRole = modelRole === 'voice' ? 'voice' : 'chat';
    const id = `custom-${normalizedRole === 'voice' ? 'voice' : 'chat'}-model-${randomUUID()}`;
    const localUri = `${FileSystemService.dir('models')}${id}-${FileSystemService.safeFileName(asset.name)}`;
    await FileSystem.copyAsync({ from: asset.uri, to: localUri });
    const info = await FileSystem.getInfoAsync(localUri);
    const sizeBytes = info.exists && 'size' in info ? (info.size ?? asset.size ?? null) : null;
    if (!sizeBytes || sizeBytes < 1024 * 1024) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      throw new Error('GGUF model file is too small to be valid.');
    }

    await ContentRepository.createPack({
      id,
      title: asset.name.replace(/\.gguf$/i, ''),
      description:
        normalizedRole === 'voice'
          ? 'User-imported GGUF voice model for on-device transcription.'
          : 'User-imported GGUF chat model for on-device AI.',
      category: 'AI Models',
      format: 'gguf',
      localUri,
      sizeBytes,
      installed: true,
      installStatus: 'installed',
      progress: 1,
    });
    return this.getPack(id);
  }

  static async addModelUrl(input: {
    title: string;
    sourceUrl: string;
    modelRole?: ContentModelRole;
    checksum?: string;
    checksumMd5?: string;
    checksumSha256?: string;
  }) {
    const sourceUrl = input.sourceUrl.trim();
    if (!/^https?:\/\//i.test(sourceUrl)) throw new Error('Use an HTTPS model URL.');
    if (!sourceUrl.toLowerCase().split('?')[0].endsWith('.gguf')) {
      throw new Error('Model URL should point to a .gguf file.');
    }
    const checksum = input.checksum?.trim().toLowerCase() || null;
    const checksumMd5 = input.checksumMd5?.trim().toLowerCase() || null;
    const checksumSha256 = input.checksumSha256?.trim().toLowerCase() || null;
    const detectedMd5 = checksum?.match(/^[a-f0-9]{32}$/) ? checksum : checksumMd5;
    const detectedSha256 = checksum?.match(/^[a-f0-9]{64}$/) ? checksum : checksumSha256;
    if (checksum && !detectedMd5 && !detectedSha256) {
      throw new Error('Checksum must be a 32-character MD5 or 64-character SHA-256 value.');
    }
    if (checksumMd5 && !/^[a-f0-9]{32}$/.test(checksumMd5)) {
      throw new Error('MD5 checksum must be 32 hexadecimal characters.');
    }
    if (checksumSha256 && !/^[a-f0-9]{64}$/.test(checksumSha256)) {
      throw new Error('SHA-256 checksum must be 64 hexadecimal characters.');
    }
    const modelRole = input.modelRole ?? 'chat';
    if (modelRole === 'embedding') {
      throw new Error('Source search uses Ark built-in ExecuTorch embeddings.');
    }
    const id = `custom-${modelRole === 'voice' ? 'voice' : 'chat'}-model-${randomUUID()}`;
    const fileName = sourceUrl.split('/').pop()?.split('?')[0] ?? `${id}.gguf`;
    await ContentRepository.createPack({
      id,
      title: input.title.trim() || fileName.replace(/\.gguf$/i, ''),
      description:
        modelRole === 'voice'
          ? 'Custom GGUF voice model URL. Download before using local transcription.'
          : 'Custom GGUF chat model URL. Download before using local AI.',
      category: 'AI Models',
      format: 'gguf',
      sourceUrl,
      sizeBytes: null,
      checksumMd5: detectedMd5,
      checksumSha256: detectedSha256,
      installed: false,
      installStatus: 'not_installed',
      progress: 0,
    });
    return this.getPack(id);
  }

  private static async findDownloadForPack(id: string) {
    const packId = parseOrThrow(contentPackIdSchema, id);
    const pack = (await ContentRepository.list()).find((item) => item.id === packId);
    if (!pack) throw new Error('Content pack not found.');
    const downloads = await DownloadManagerService.listDownloads();
    const activeStatuses = new Set(['queued', 'downloading', 'verifying', 'paused']);
    const download =
      downloads.find(
        (item) => item.sourceUrl === pack.sourceUrl && activeStatuses.has(item.status)
      ) ??
      downloads.find(
        (item) => item.localUri === pack.localUri && activeStatuses.has(item.status)
      ) ??
      null;
    return { pack, download };
  }
}

const GGUF_MAGIC = 0x46554747; // "GGUF" little-endian

function isGgufMagicHeader(base64Header: string) {
  if (!base64Header) return false;
  let bytes: Uint8Array;
  try {
    const binary = atob(base64Header);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
  } catch {
    return false;
  }
  if (bytes.length < 4) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0, true) === GGUF_MAGIC;
}
