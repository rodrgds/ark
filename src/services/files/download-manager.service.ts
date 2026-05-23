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
  download?: FileSystem.DownloadResumable;
  packId?: string | null;
  progress: number;
  localUri: string;
  stopReason?: 'paused' | 'canceled';
  cancel?: () => Promise<void>;
};

const DOWNLOAD_HEADERS = {
  Accept: 'application/pdf,application/zim,application/octet-stream,*/*',
  'Accept-Encoding': 'identity',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Ark Offline) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36',
};

const MIN_EXPECTED_SIZE_RATIO = 0.98;
const SNAPSHOT_ACCEPT_HEADER = 'text/html,application/xhtml+xml,*/*';
const SNAPSHOT_THEME_CSS = `
  :root {
    --bg: #000000;
    --fg: #e4e4e7;
    --fg-muted: #a1a1aa;
    --accent: #f2b84b;
    --card-bg: #0a0a0a;
    --border: #27272a;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.65;
  }
  body { padding: 16px; }
  .ark-snapshot {
    max-width: 720px;
    margin: 0 auto;
  }
  .ark-snapshot-header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .ark-snapshot-kicker {
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .ark-snapshot h1, .ark-snapshot h2, .ark-snapshot h3, .ark-snapshot h4 {
    color: var(--fg);
    line-height: 1.25;
  }
  .ark-snapshot h1 { font-size: 30px; margin: 0 0 12px; }
  .ark-snapshot h2 { font-size: 22px; margin-top: 28px; }
  .ark-snapshot h3 { font-size: 18px; margin-top: 22px; }
  .ark-snapshot img {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    margin: 16px 0;
    border-radius: 10px;
  }
  .ark-snapshot figure { margin: 20px 0; }
  .ark-snapshot figcaption {
    color: var(--fg-muted);
    font-size: 13px;
  }
  .ark-snapshot a { color: var(--accent); }
  .ark-snapshot table {
    width: 100%;
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 16px 0;
  }
  .ark-snapshot th, .ark-snapshot td {
    border: 1px solid var(--border);
    padding: 8px 10px;
    text-align: left;
  }
  .ark-snapshot th { background: var(--card-bg); }
  .ark-snapshot ul, .ark-snapshot ol { padding-left: 20px; }
`;

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

function snapshotRootUri(directory: AppDirectory, fileName: string, title: string) {
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, '') || title;
  const safeBaseName = sanitizeFileName(baseName.toLowerCase()) || 'page';
  return `${FileSystemService.dir(directory)}${safeBaseName}/`;
}

function parentDirectory(uri: string) {
  const separatorIndex = uri.lastIndexOf('/');
  return separatorIndex === -1 ? uri : uri.slice(0, separatorIndex + 1);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function utf8ByteLength(value: string) {
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) length += 1;
    else if (code <= 0x7ff) length += 2;
    else if (code >= 0xd800 && code <= 0xdfff) {
      length += 4;
      index += 1;
    } else {
      length += 3;
    }
  }
  return length;
}

function isNavigableUrl(value: string) {
  return !/^(#|mailto:|tel:|javascript:|data:)/i.test(value);
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  if (!value.trim() || !isNavigableUrl(value.trim())) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractTitle(html: string, fallback: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const raw = titleMatch?.[1] ?? h1Match?.[1] ?? fallback;
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

function extractReadableBody(html: string) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  const mainMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const content = mainMatch?.[1] ?? articleMatch?.[1] ?? bodyMatch?.[1] ?? cleaned;
  return content
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .trim();
}

function collectImageUrls(html: string, baseUrl: string) {
  const matches = html.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1/gi);
  const urls = new Set<string>();
  for (const match of matches) {
    const absoluteUrl = toAbsoluteUrl(match[2] ?? '', baseUrl);
    if (absoluteUrl) urls.add(absoluteUrl);
  }
  return Array.from(urls);
}

function rewriteSnapshotContent(html: string, baseUrl: string, imageMap: Map<string, string>) {
  const withoutSrcSet = html
    .replace(/\s+srcset=(["'])[\s\S]*?\1/gi, '')
    .replace(/\s+sizes=(["'])[\s\S]*?\1/gi, '');
  const withLocalImages = withoutSrcSet.replace(
    /(<img\b[^>]*\bsrc=(["']))(.*?)(\2)/gi,
    (full, prefix, _quote, value, suffix) => {
      const absoluteUrl = toAbsoluteUrl(value, baseUrl);
      const localUrl = absoluteUrl ? imageMap.get(absoluteUrl) : null;
      return localUrl ? `${prefix}${localUrl}${suffix}` : full;
    }
  );
  return withLocalImages.replace(
    /(<a\b[^>]*\bhref=(["']))(.*?)(\2)/gi,
    (full, prefix, _quote, value, suffix) => {
      const absoluteUrl = toAbsoluteUrl(value, baseUrl);
      return absoluteUrl ? `${prefix}${absoluteUrl}${suffix}` : full;
    }
  );
}

function wrapSnapshotHtml(input: { title: string; sourceUrl: string; body: string }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
  <title>${escapeHtml(input.title)}</title>
  <style id="ark-theme">${SNAPSHOT_THEME_CSS}</style>
</head>
<body>
  <article class="ark-snapshot">
    <header class="ark-snapshot-header">
      <div class="ark-snapshot-kicker">Offline guide snapshot</div>
      <h1>${escapeHtml(input.title)}</h1>
      <p><a href="${escapeHtml(input.sourceUrl)}">${escapeHtml(input.sourceUrl)}</a></p>
    </header>
    ${input.body}
  </article>
</body>
</html>`;
}

function isHtmlSnapshotUri(uri: string) {
  return uri.toLowerCase().endsWith('/index.html');
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
    snapshotHtml?: boolean;
  }) {
    await FileSystemService.ensureAppDirectories();
    await FileSystemService.ensureSpaceForDownload(input.expectedSizeBytes);
    const directory = input.directory ?? defaultDirectory(input.kind);
    const fileName = input.fileName ?? inferFileName(input.sourceUrl, `${input.title}.bin`);
    const localUri = input.snapshotHtml
      ? `${snapshotRootUri(directory, fileName, input.title)}index.html`
      : `${FileSystemService.dir(directory)}${fileName}`;
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

    if (input.snapshotHtml) {
      void this.runHtmlSnapshot({
        id,
        kind: input.kind,
        title: input.title,
        packId: input.packId,
        sourceUrl: input.sourceUrl,
        localUri,
      });
    } else {
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
    }
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

  private static async runHtmlSnapshot(input: {
    id: string;
    kind: DownloadKind;
    title: string;
    packId?: string | null;
    sourceUrl: string;
    localUri: string;
  }) {
    const controller = new AbortController();
    const snapshotRoot = parentDirectory(input.localUri);
    const assetRoot = `${snapshotRoot}assets/`;
    let currentAssetDownload: FileSystem.DownloadResumable | null = null;
    let active: ActiveDownload | null = null;

    try {
      active = {
        packId: input.packId,
        progress: 0,
        localUri: input.localUri,
        cancel: async () => {
          controller.abort();
          if (currentAssetDownload) {
            await currentAssetDownload.cancelAsync().catch(() => undefined);
          }
          await FileSystem.deleteAsync(snapshotRoot, { idempotent: true }).catch(() => undefined);
        },
      };
      this.activeDownloads.set(input.id, active);

      await FileSystem.deleteAsync(snapshotRoot, { idempotent: true }).catch(() => undefined);
      await FileSystem.makeDirectoryAsync(snapshotRoot, { intermediates: true }).catch(
        () => undefined
      );
      await this.updateProgressState(input.id, input.packId, input.localUri, 0.08);

      const response = await fetch(input.sourceUrl, {
        headers: {
          ...DOWNLOAD_HEADERS,
          Accept: SNAPSHOT_ACCEPT_HEADER,
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);

      const rawHtml = await response.text();
      const readableBody = extractReadableBody(rawHtml);
      const pageTitle = extractTitle(rawHtml, input.title);
      const imageUrls = collectImageUrls(readableBody, input.sourceUrl);
      const imageMap = new Map<string, string>();
      const downloadedAssetUris: string[] = [];

      if (imageUrls.length) {
        await FileSystem.makeDirectoryAsync(assetRoot, { intermediates: true }).catch(
          () => undefined
        );
      }

      await this.updateProgressState(input.id, input.packId, input.localUri, 0.2);

      for (let index = 0; index < imageUrls.length; index += 1) {
        if (controller.signal.aborted) throw new Error('Download canceled.');
        const imageUrl = imageUrls[index];
        const assetFileName = `${String(index + 1).padStart(2, '0')}-${inferFileName(
          imageUrl,
          'image'
        )}`;
        const destinationUri = `${assetRoot}${assetFileName}`;
        currentAssetDownload = FileSystem.createDownloadResumable(
          imageUrl,
          destinationUri,
          {
            md5: false,
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
            headers: DOWNLOAD_HEADERS,
          }
        );

        try {
          const result = await currentAssetDownload.downloadAsync();
          if (result?.uri && (!result.status || (result.status >= 200 && result.status < 300))) {
            imageMap.set(imageUrl, `assets/${assetFileName}`);
            downloadedAssetUris.push(result.uri);
          } else {
            await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(
              () => undefined
            );
          }
        } catch {
          await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => undefined);
        } finally {
          currentAssetDownload = null;
        }

        const progress = 0.2 + ((index + 1) / Math.max(imageUrls.length, 1)) * 0.65;
        await this.updateProgressState(input.id, input.packId, input.localUri, progress);
      }

      const snapshotHtml = wrapSnapshotHtml({
        title: pageTitle,
        sourceUrl: input.sourceUrl,
        body: rewriteSnapshotContent(readableBody, input.sourceUrl, imageMap),
      });
      await FileSystem.writeAsStringAsync(input.localUri, snapshotHtml, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const assetInfos = await Promise.all(
        downloadedAssetUris.map((uri) => FileSystem.getInfoAsync(uri).catch(() => null))
      );
      const totalBytes =
        utf8ByteLength(snapshotHtml) +
        assetInfos.reduce((sum, info) => {
          if (!info || !info.exists || !('size' in info)) return sum;
          return sum + (info.size ?? 0);
        }, 0);

      await this.finalizeDownloadedFile({
        id: input.id,
        kind: input.kind,
        packId: input.packId,
        resultUri: input.localUri,
        resolvedSizeBytes: totalBytes,
      });
    } catch (error) {
      if (controller.signal.aborted || active?.stopReason === 'canceled') {
        await DownloadsRepository.updateStatus(input.id, 'canceled', active?.progress ?? 0, null);
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

      await FileSystem.deleteAsync(snapshotRoot, { idempotent: true }).catch(() => undefined);
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
    if (!active.download) {
      throw new Error('This download is short and cannot be paused. Cancel it and restart later.');
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
    if (row.kind === 'guide' && isHtmlSnapshotUri(row.localUri)) {
      await this.runHtmlSnapshot({
        id: row.id,
        kind: row.kind,
        title: row.title,
        packId,
        sourceUrl: row.sourceUrl,
        localUri: row.localUri,
      });
      return;
    }
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
      if (active.cancel) await active.cancel();
      else if (active.download) await active.download.cancelAsync();
    }
    if (row.localUri) {
      const targetUri =
        row.kind === 'guide' && isHtmlSnapshotUri(row.localUri)
          ? parentDirectory(row.localUri)
          : row.localUri;
      await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined);
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
    resolvedSizeBytes?: number | null;
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
    const fileSizeBytes = info.exists && 'size' in info ? info.size : null;
    const sizeBytes = input.resolvedSizeBytes ?? fileSizeBytes;
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

  private static async updateProgressState(
    id: string,
    packId: string | null | undefined,
    localUri: string,
    progress: number
  ) {
    const nextProgress = Math.max(0, Math.min(progress, 0.99));
    const active = this.activeDownloads.get(id);
    if (active) active.progress = nextProgress;
    await DownloadsRepository.updateProgress({
      id,
      progress: nextProgress,
      localUri,
    });
    if (packId) {
      await ContentRepository.updateInstallStatus({
        id: packId,
        status: 'downloading',
        progress: nextProgress,
        localUri,
      });
    }
  }
}
