import { DownloadsRepository } from '@/services/db/repositories/downloads.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { RagService } from '@/services/ai/rag.service';
import { FileDigestService } from '@/services/files/file-digest.service';
import { ZimHeaderParser } from '@/services/content/zim-header';
import type { AppDirectory } from '@/constants/app';
import type { DownloadKind } from '@/types/downloads';
import * as FileSystem from 'expo-file-system/legacy';

type ActiveDownload = {
  download: FileSystem.DownloadResumable;
  packId?: string | null;
  progress: number;
  localUri: string;
  stopReason?: 'paused' | 'canceled';
};

const DOWNLOAD_HEADERS = {
  Accept: 'application/pdf,application/zim,application/octet-stream,*/*',
  'Accept-Encoding': 'identity',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Ark Offline) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36',
};

const MIN_EXPECTED_SIZE_RATIO = 0.98;

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function defaultDirectory(kind: DownloadKind): AppDirectory {
  if (kind === 'map') return 'maps';
  if (kind === 'model') return 'models';
  if (kind === 'document') return 'imports';
  return 'content';
}

function inferFileName(sourceUrl: string, fallback: string) {
  const cleanUrl = sourceUrl.split('?')[0];
  const lastSegment = cleanUrl.split('/').filter(Boolean).pop();
  return sanitizeFileName(lastSegment ?? fallback);
}

export class DownloadManagerService {
  private static activeDownloads = new Map<string, ActiveDownload>();

  static async queueDownload(input: {
    kind: DownloadKind;
    title: string;
    packId?: string | null;
    sourceUrl: string;
    fileName?: string | null;
    directory?: AppDirectory;
    expectedChecksumMd5?: string | null;
    expectedChecksumSha256?: string | null;
    expectedChecksumSha256Url?: string | null;
    expectedSizeBytes?: number | null;
  }) {
    await FileSystemService.ensureAppDirectories();
    await FileSystemService.ensureSpaceForDownload(input.expectedSizeBytes);
    const directory = input.directory ?? defaultDirectory(input.kind);
    const fileName = input.fileName ?? inferFileName(input.sourceUrl, `${input.title}.bin`);
    const localUri = `${FileSystemService.dir(directory)}${fileName}`;
    const expectedChecksumSha256 = await FileDigestService.resolveExpectedSha256({
      checksumSha256: input.expectedChecksumSha256,
      checksumSha256Url: input.expectedChecksumSha256Url,
    });
    const id = await DownloadsRepository.create({
      kind: input.kind,
      title: input.title,
      sourceUrl: input.sourceUrl,
      localUri,
      expectedChecksumMd5: input.expectedChecksumMd5,
      expectedChecksumSha256,
    });
    if (input.packId) {
      await ContentRepository.updateInstallStatus({
        id: input.packId,
        status: 'downloading',
        progress: 0,
        localUri,
      });
    }

    void this.runDownload({
      id,
      kind: input.kind,
      title: input.title,
      packId: input.packId,
      sourceUrl: input.sourceUrl,
      localUri,
      expectedChecksumMd5: input.expectedChecksumMd5,
      expectedChecksumSha256,
      resumeData: null,
      expectedSizeBytes: input.expectedSizeBytes,
    });
    return id;
  }

  private static async runDownload(input: {
    id: string;
    kind: DownloadKind;
    title: string;
    packId?: string | null;
    sourceUrl: string;
    localUri: string;
    expectedChecksumMd5?: string | null;
    expectedChecksumSha256?: string | null;
    resumeData?: string | null;
    expectedSizeBytes?: number | null;
  }) {
    let active: ActiveDownload | null = null;
    try {
      if (!input.resumeData && (await this.canFinalizeExistingFile(input.localUri, input))) {
        await this.finalizeDownloadedFile({
          ...input,
          resultUri: input.localUri,
          checksumMd5: null,
        });
        return;
      }

      await DownloadsRepository.updateProgress({
        id: input.id,
        progress: 0,
        localUri: input.localUri,
      });
      let lastWriteAt = 0;
      const download = FileSystem.createDownloadResumable(
        input.sourceUrl,
        input.localUri,
        {
          md5: true,
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
          headers: DOWNLOAD_HEADERS,
        },
        (event) => {
          const totalBytes = event.totalBytesExpectedToWrite || null;
          const downloadedBytes = event.totalBytesWritten;
          const progress = totalBytes ? downloadedBytes / totalBytes : 0;
          const runningDownload = this.activeDownloads.get(input.id);
          if (runningDownload) runningDownload.progress = progress;
          const timestamp = Date.now();
          if (timestamp - lastWriteAt < 750 && progress < 1) return;
          lastWriteAt = timestamp;
          void DownloadsRepository.updateProgress({
            id: input.id,
            progress,
            totalBytes,
            downloadedBytes,
            localUri: input.localUri,
          });
          if (input.packId) {
            void ContentRepository.updateInstallStatus({
              id: input.packId,
              status: 'downloading',
              progress,
              localUri: input.localUri,
              sizeBytes: totalBytes,
            });
          }
        },
        input.resumeData ?? undefined
      );
      active = {
        download,
        packId: input.packId,
        progress: 0,
        localUri: input.localUri,
      };
      this.activeDownloads.set(input.id, active);
      const result = await download.downloadAsync();
      if (!result?.uri && active.stopReason === 'canceled') {
        await DownloadsRepository.updateStatus(input.id, 'canceled', active.progress, null);
        if (input.packId) {
          await ContentRepository.updateInstallStatus({
            id: input.packId,
            status: 'not_installed',
            progress: 0,
            localUri: null,
          });
        }
        return;
      }
      if (!result?.uri && active.stopReason === 'paused') return;
      if (!result?.uri) throw new Error('Download finished without a local file URI.');
      if (result.status && (result.status < 200 || result.status >= 300)) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        throw new Error(`Download failed with HTTP ${result.status}.`);
      }
      if (
        input.expectedChecksumMd5 &&
        result.md5 &&
        input.expectedChecksumMd5.toLowerCase() !== result.md5.toLowerCase()
      ) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        throw new Error('Downloaded file failed MD5 verification.');
      }
      await this.finalizeDownloadedFile({
        ...input,
        resultUri: result.uri,
        checksumMd5: result.md5 ?? null,
      });
      if (input.packId) {
        await ContentRepository.updateInstallStatus({
          id: input.packId,
          status: 'installed',
          progress: 1,
          localUri: result.uri,
          sizeBytes,
        });
        await RagService.indexContentPack(input.packId).catch(() => undefined);
      }
    } catch (error) {
      if (active?.stopReason === 'paused' || active?.stopReason === 'canceled') return;
      const message = error instanceof Error ? error.message : 'Download failed.';
      await DownloadsRepository.updateStatus(input.id, 'failed', 0, message);
      if (input.packId) {
        await ContentRepository.updateInstallStatus({
          id: input.packId,
          status: 'failed',
          progress: 0,
          localUri: input.localUri,
        });
      }
    } finally {
      if (this.activeDownloads.get(input.id) === active) {
        this.activeDownloads.delete(input.id);
      }
    }
  }

  static listDownloads() {
    return DownloadsRepository.list();
  }

  static async pauseDownload(id: string) {
    const active = this.activeDownloads.get(id);
    const row = await DownloadsRepository.get(id);
    if (!row) throw new Error('Download not found.');
    if (!active) {
      await DownloadsRepository.updateStatus(id, 'paused', row.progress, null);
      return;
    }
    active.stopReason = 'paused';
    const pauseState = await active.download.pauseAsync();
    const resumeData = pauseState.resumeData ?? active.download.savable().resumeData ?? null;
    await DownloadsRepository.pause({
      id,
      progress: active.progress || row.progress,
      resumeData,
    });
    if (active.packId) {
      await ContentRepository.updateInstallStatus({
        id: active.packId,
        status: 'paused',
        progress: active.progress || row.progress,
        localUri: active.localUri,
      });
    }
  }

  static async resumeDownload(id: string, packId?: string | null) {
    const row = await DownloadsRepository.get(id);
    if (!row?.sourceUrl || !row.localUri) throw new Error('Download cannot be resumed.');
    await this.runDownload({
      id: row.id,
      kind: row.kind,
      title: row.title,
      packId,
      sourceUrl: row.sourceUrl,
      localUri: row.localUri,
      expectedChecksumMd5: row.expectedChecksumMd5,
      expectedChecksumSha256: row.expectedChecksumSha256,
      resumeData: row.resumeData,
      expectedSizeBytes: row.totalBytes,
    });
  }

  static async cancelDownload(id: string) {
    const row = await DownloadsRepository.get(id);
    if (!row) throw new Error('Download not found.');
    const active = this.activeDownloads.get(id);
    if (active) {
      active.stopReason = 'canceled';
      await active.download.cancelAsync();
    }
    if (row.localUri) {
      await FileSystem.deleteAsync(row.localUri, { idempotent: true }).catch(() => undefined);
    }
    await DownloadsRepository.updateStatus(id, 'canceled', 0, null);
  }

  private static async canFinalizeExistingFile(
    uri: string,
    input: { kind: DownloadKind; expectedSizeBytes?: number | null }
  ) {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (!info?.exists || info.isDirectory) return false;
    const sizeBytes = 'size' in info ? (info.size ?? null) : null;
    if (
      input.expectedSizeBytes &&
      (!sizeBytes || sizeBytes < input.expectedSizeBytes * MIN_EXPECTED_SIZE_RATIO)
    ) {
      return false;
    }
    if (input.kind === 'guide' && uri.toLowerCase().endsWith('.pdf')) {
      const validPdf = await this.hasPdfHeader(uri);
      if (!validPdf) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
        return false;
      }
    }
    return true;
  }

  private static async finalizeDownloadedFile(input: {
    id: string;
    kind: DownloadKind;
    packId?: string | null;
    resultUri: string;
    expectedChecksumMd5?: string | null;
    expectedChecksumSha256?: string | null;
    expectedSizeBytes?: number | null;
    checksumMd5?: string | null;
  }) {
    await DownloadsRepository.updateStatus(input.id, 'verifying', 1, null);
    if (input.packId) {
      await ContentRepository.updateInstallStatus({
        id: input.packId,
        status: 'verifying',
        progress: 1,
        localUri: input.resultUri,
      });
    }

    const info = await FileSystem.getInfoAsync(input.resultUri);
    const sizeBytes = info.exists && 'size' in info ? info.size : null;
    if (
      input.expectedSizeBytes &&
      (!sizeBytes || sizeBytes < input.expectedSizeBytes * MIN_EXPECTED_SIZE_RATIO)
    ) {
      await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
      throw new Error('Downloaded file is smaller than expected. Retry from a stable connection.');
    }

    if (
      input.expectedChecksumMd5 &&
      input.checksumMd5 &&
      input.expectedChecksumMd5.toLowerCase() !== input.checksumMd5.toLowerCase()
    ) {
      await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
      throw new Error('Downloaded file failed MD5 verification.');
    }

    if (input.kind === 'guide' && input.resultUri.toLowerCase().endsWith('.pdf')) {
      const validPdf = await this.hasPdfHeader(input.resultUri);
      if (!validPdf) {
        await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
        throw new Error(
          'Verification failed: the server returned a web page instead of the PDF. Retry later or use another network.'
        );
      }
    }

    if (input.kind === 'zim') {
      const header = await ZimHeaderParser.parse(input.resultUri);
      if (!header.valid) {
        await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
        throw new Error('Downloaded file is not a valid ZIM archive.');
      }
    }

    let checksumSha256: string | null = null;
    if (input.expectedChecksumSha256) {
      const digest = await FileDigestService.sha256FileIfReasonable(input.resultUri, sizeBytes);
      checksumSha256 = digest.checksumSha256;
      if (
        checksumSha256 &&
        checksumSha256.toLowerCase() !== input.expectedChecksumSha256.toLowerCase()
      ) {
        await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
        throw new Error('Downloaded file failed SHA-256 verification.');
      }
    }

    await DownloadsRepository.complete({
      id: input.id,
      localUri: input.resultUri,
      totalBytes: sizeBytes,
      downloadedBytes: sizeBytes,
      checksumMd5: input.checksumMd5 ?? null,
      checksumSha256,
    });
    if (input.packId) {
      await ContentRepository.updateInstallStatus({
        id: input.packId,
        status: 'installed',
        progress: 1,
        localUri: input.resultUri,
        sizeBytes,
      });
      await RagService.indexContentPack(input.packId).catch(() => undefined);
    }
  }

  private static async hasPdfHeader(uri: string) {
    const headerText = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
      length: 10,
    }).catch(() => '');
    return headerText.startsWith('%PDF');
  }
}
