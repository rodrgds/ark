import { DownloadsRepository } from '@/services/db/repositories/downloads.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { RagService } from '@/services/ai/rag.service';
import { FileDigestService } from '@/services/files/file-digest.service';
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
  }) {
    let active: ActiveDownload | null = null;
    try {
      await DownloadsRepository.updateProgress({
        id: input.id,
        progress: 0,
        localUri: input.localUri,
      });
      let lastWriteAt = 0;
      const download = FileSystem.createDownloadResumable(
        input.sourceUrl,
        input.localUri,
        { md5: true, sessionType: FileSystem.FileSystemSessionType.BACKGROUND },
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
      if (
        input.expectedChecksumMd5 &&
        result.md5 &&
        input.expectedChecksumMd5.toLowerCase() !== result.md5.toLowerCase()
      ) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        throw new Error('Downloaded file failed checksum verification.');
      }
      const info = await FileSystem.getInfoAsync(result.uri);
      const sizeBytes = info.exists && 'size' in info ? info.size : null;
      let checksumSha256: string | null = null;
      if (input.expectedChecksumSha256) {
        const digest = await FileDigestService.sha256FileIfReasonable(result.uri, sizeBytes);
        checksumSha256 = digest.checksumSha256;
        if (
          checksumSha256 &&
          checksumSha256.toLowerCase() !== input.expectedChecksumSha256.toLowerCase()
        ) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
          throw new Error('Downloaded file failed SHA-256 verification.');
        }
      }
      await DownloadsRepository.complete({
        id: input.id,
        localUri: result.uri,
        totalBytes: sizeBytes,
        downloadedBytes: sizeBytes,
        checksumMd5: result.md5 ?? null,
        checksumSha256,
      });
      if (input.packId) {
        await ContentRepository.updateInstallStatus({
          id: input.packId,
          status: 'installed',
          progress: 1,
          localUri: result.uri,
          sizeBytes,
        });
        await RagService.indexContentPack(input.packId);
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
}
