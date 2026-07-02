import { DownloadsRepository } from '@/services/db/repositories/downloads.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { NetworkService } from '@/services/connectivity/network.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { RagService } from '@/services/ai/rag.service';
import { FileDigestService } from '@/services/files/file-digest.service';
import { DownloadNotificationService } from '@/services/files/download-notifications.service';
import { ZimHeaderParser } from '@/services/content/zim-header';
import { arkDownloadHeaders } from '@/services/files/http-headers';
import { stripFailedImageTags } from '@/services/files/snapshot-html';
import type { AppDirectory } from '@/constants/app';
import type { DownloadKind, DownloadRow } from '@/types/downloads';
import * as FileSystem from 'expo-file-system/legacy';

type ActiveDownload = {
  kind: DownloadKind;
  download?: FileSystem.DownloadResumable;
  packId?: string | null;
  progress: number;
  localUri: string;
  stopReason?: 'paused' | 'canceled';
  cancel?: () => Promise<void>;
};

type DownloadRunInput = {
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
};

const MAX_ACTIVE_DOWNLOADS = 3;
const MIN_EXPECTED_SIZE_RATIO = 0.98;
const RESUME_DATA_MAX_AGE_MS = 30 * 60 * 1000;
const SNAPSHOT_ACCEPT_HEADER = 'text/html,application/xhtml+xml,*/*';
const WIFI_ONLY_PAUSE_REASON =
  'Wi-Fi-only downloads are on. Connect to Wi-Fi or turn it off in Settings.';
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

import { escapeHtml, utf8ByteLength } from '@/lib/format';
import { filterSnapshotChrome } from '@/services/files/snapshot-image-filter';
import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { withDefuddleDomGlobals } from '@/services/content/defuddle-runtime';

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
  return (
    raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || fallback
  );
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

function isUserCachedWebPage(packId: string | null | undefined) {
  return typeof packId === 'string' && packId.startsWith('user-web-');
}

async function extractUserWebBody(rawHtml: string, sourceUrl: string) {
  const dom = parseHTML(rawHtml);
  return withDefuddleDomGlobals(dom, async () => {
    const result = await Defuddle(dom.document as Parameters<typeof Defuddle>[0], sourceUrl, {
      markdown: false,
      standardize: true,
      removeHiddenElements: true,
      removeLowScoring: true,
    });
    const content = (result?.content ?? '').toString();
    if (!content.trim()) {
      throw new Error('Unable to extract readable content from this page.');
    }
    return { html: content, title: (result?.title ?? '').toString().trim() };
  });
}

function isActiveStatus(status: DownloadRow['status']) {
  return (
    status === 'queued' || status === 'downloading' || status === 'verifying' || status === 'paused'
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Operation timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class DownloadManagerService {
  private static activeDownloads = new Map<string, ActiveDownload>();
  private static downloadPackIds = new Map<string, string | null | undefined>();
  private static drainingQueue = false;
  private static queueLocks = new Map<string, Promise<unknown>>();
  private static lifecycleSubscription: { remove: () => void } | null = null;

  private static async withQueueLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queueLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queueLocks.set(
      key,
      previous.then(() => next)
    );
    try {
      await previous;
      return await fn();
    } finally {
      release();
      if (this.queueLocks.get(key) === next) {
        this.queueLocks.delete(key);
      }
    }
  }

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
    const directory = input.directory ?? defaultDirectory(input.kind);
    const fileName = input.fileName ?? inferFileName(input.sourceUrl, `${input.title}.bin`);
    const localUri = input.snapshotHtml
      ? `${snapshotRootUri(directory, fileName, input.title)}index.html`
      : `${FileSystemService.dir(directory)}${fileName}`;

    const lockKey = input.sourceUrl || localUri;
    return this.withQueueLock(lockKey, async () => {
      const priorDownloads = await DownloadsRepository.list();
      const priorPartial = priorDownloads.find(
        (download) =>
          (download.sourceUrl === input.sourceUrl || download.localUri === localUri) &&
          typeof download.downloadedBytes === 'number'
      );
      await FileSystemService.ensureSpaceForDownload(input.expectedSizeBytes, {
        alreadyOnDiskBytes: priorPartial?.downloadedBytes ?? null,
      });
      const existing = priorDownloads.find(
        (download) =>
          isActiveStatus(download.status) &&
          (download.sourceUrl === input.sourceUrl || download.localUri === localUri)
      );
      if (existing) {
        this.downloadPackIds.set(existing.id, input.packId);
        const active = this.activeDownloads.has(existing.id);
        const status =
          active && (existing.status === 'downloading' || existing.status === 'verifying')
            ? existing.status
            : existing.status === 'paused'
              ? 'paused'
              : 'queued';
        if (!active && existing.status !== 'paused') {
          await DownloadsRepository.markQueued({
            id: existing.id,
            progress: existing.progress,
            clearResumeData: false,
          });
        }
        if (input.packId) {
          await ContentRepository.updateInstallStatus({
            id: input.packId,
            status,
            progress: existing.progress,
            localUri,
          });
        }
        this.drainQueueSoon();
        return existing.id;
      }

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
      this.downloadPackIds.set(id, input.packId);
      if (input.packId) {
        await ContentRepository.updateInstallStatus({
          id: input.packId,
          status: 'queued',
          progress: 0,
          localUri,
        });
      }

      this.drainQueueSoon();
      return id;
    });
  }

  static async recoverPendingDownloads() {
    await DownloadNotificationService.configure().catch(() => undefined);
    const pending = await DownloadsRepository.listByStatuses([
      'queued',
      'downloading',
      'verifying',
    ]);
    for (const row of pending) {
      if (!row.sourceUrl || !row.localUri) continue;
      const packId = await this.resolvePackIdForDownload(row);
      this.downloadPackIds.set(row.id, packId);
      await DownloadsRepository.markQueued({
        id: row.id,
        progress: row.progress,
        clearResumeData: false,
      });
      if (packId) {
        await ContentRepository.updateInstallStatus({
          id: packId,
          status: 'queued',
          progress: row.progress,
          localUri: row.localUri,
        });
      }
    }
    this.drainQueueSoon();
  }

  static bindLifecycle() {
    if (this.lifecycleSubscription) return () => undefined;
    void import('react-native')
      .then(({ AppState }) => {
        if (this.lifecycleSubscription) return;
        this.lifecycleSubscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void this.recoverPendingDownloads();
          }
        });
      })
      .catch(() => undefined);
    return () => {
      this.lifecycleSubscription?.remove();
      this.lifecycleSubscription = null;
    };
  }

  private static drainQueueSoon() {
    void this.drainQueue();
  }

  private static async drainQueue() {
    if (this.drainingQueue) return;
    this.drainingQueue = true;
    try {
      if (this.activeDownloads.size >= MAX_ACTIVE_DOWNLOADS) return;
      const queuedRows = (await DownloadsRepository.listByStatuses(['queued'])).filter(
        (row) => row.sourceUrl && row.localUri && !this.activeDownloads.has(row.id)
      );
      if (queuedRows.length === 0) return;

      const gate = await this.getDownloadGate();
      if (!gate.allowed) {
        await Promise.all(
          queuedRows.map(async (row) => {
            const rowPackId = await this.resolvePackIdForDownload(row);
            await this.pauseQueuedForNetwork(row, rowPackId, gate.reason);
          })
        );
        return;
      }

      const slotsAvailable = MAX_ACTIVE_DOWNLOADS - this.activeDownloads.size;
      const toStart = queuedRows.slice(0, slotsAvailable);
      for (const queued of toStart) {
        if (!queued.sourceUrl || !queued.localUri) continue;
        const latest = await DownloadsRepository.get(queued.id);
        if (latest?.status !== 'queued') continue;
        const packId = await this.resolvePackIdForDownload(queued);
        this.downloadPackIds.set(queued.id, packId);
        if (queued.kind === 'guide' && isHtmlSnapshotUri(queued.localUri)) {
          if (isUserCachedWebPage(packId)) {
            void this.runUserWebSnapshot({
              id: queued.id,
              kind: queued.kind,
              title: queued.title,
              packId,
              sourceUrl: queued.sourceUrl,
              localUri: queued.localUri,
            });
          } else {
            void this.runHtmlSnapshot({
              id: queued.id,
              kind: queued.kind,
              title: queued.title,
              packId,
              sourceUrl: queued.sourceUrl,
              localUri: queued.localUri,
            });
          }
        } else {
          void this.runDownload({
            id: queued.id,
            kind: queued.kind,
            title: queued.title,
            packId,
            sourceUrl: queued.sourceUrl,
            localUri: queued.localUri,
            expectedChecksumMd5: queued.expectedChecksumMd5,
            expectedChecksumSha256: queued.expectedChecksumSha256,
            resumeData: queued.resumeData,
            expectedSizeBytes: queued.totalBytes,
          });
        }
      }
    } finally {
      this.drainingQueue = false;
    }
  }

  private static async getDownloadGate() {
    if (!(await PreferencesService.getWifiOnlyDownloadsEnabled())) {
      return { allowed: true as const };
    }
    const state = await NetworkService.getState().catch(() => null);
    if (NetworkService.isWifi(state)) return { allowed: true as const };
    return { allowed: false as const, reason: WIFI_ONLY_PAUSE_REASON };
  }

  private static async pauseQueuedForNetwork(
    row: DownloadRow,
    packId: string | null | undefined,
    reason: string
  ) {
    await DownloadsRepository.updateStatus(row.id, 'paused', row.progress ?? 0, reason);
    if (packId && row.localUri) {
      await ContentRepository.updateInstallStatus({
        id: packId,
        status: 'paused',
        progress: row.progress ?? 0,
        localUri: row.localUri,
      });
    }
  }

  private static async resolvePackIdForDownload(row: DownloadRow) {
    if (this.downloadPackIds.has(row.id)) return this.downloadPackIds.get(row.id);
    const packs = await ContentRepository.list();
    const pack = packs.find(
      (candidate) =>
        (row.sourceUrl && candidate.sourceUrl === row.sourceUrl) ||
        (row.localUri && candidate.localUri === row.localUri)
    );
    return pack?.id ?? null;
  }

  private static async runDownload(input: DownloadRunInput) {
    let active: ActiveDownload | null = null;
    try {
      active = {
        kind: input.kind,
        packId: input.packId,
        progress: 0,
        localUri: input.localUri,
      };
      this.activeDownloads.set(input.id, active);

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
      void DownloadNotificationService.progress({
        id: input.id,
        kind: input.kind,
        title: input.title,
        progress: 0,
        status: 'downloading',
      });
      if (input.packId) {
        await ContentRepository.updateInstallStatus({
          id: input.packId,
          status: 'downloading',
          progress: 0,
          localUri: input.localUri,
        });
      }
      let lastWriteAt = 0;
      const download = FileSystem.createDownloadResumable(
        input.sourceUrl,
        input.localUri,
        {
          md5: true,
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
          headers: arkDownloadHeaders(),
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
          void DownloadNotificationService.progress({
            id: input.id,
            kind: input.kind,
            title: input.title,
            progress,
            status: 'downloading',
          });
        },
        input.resumeData ?? undefined
      );
      active.download = download;
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
      await DownloadNotificationService.terminal({
        id: input.id,
        kind: input.kind,
        title: input.title,
        progress: 0,
        status: 'failed',
      });
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
      this.downloadPackIds.delete(input.id);
      this.drainQueueSoon();
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
        kind: input.kind,
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
      void DownloadNotificationService.progress({
        id: input.id,
        kind: input.kind,
        title: input.title,
        progress: 0,
        status: 'downloading',
      });
      if (input.packId) {
        await ContentRepository.updateInstallStatus({
          id: input.packId,
          status: 'downloading',
          progress: 0,
          localUri: input.localUri,
        });
      }

      await FileSystem.deleteAsync(snapshotRoot, { idempotent: true }).catch(() => undefined);
      await FileSystem.makeDirectoryAsync(snapshotRoot, { intermediates: true }).catch(
        () => undefined
      );
      await this.updateProgressState(input.id, input.packId, input.localUri, input.title, 0.08);

      const response = await fetch(input.sourceUrl, {
        headers: {
          ...arkDownloadHeaders({ accept: SNAPSHOT_ACCEPT_HEADER }),
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);

      const rawHtml = await response.text();
      const readableBody = filterSnapshotChrome(extractReadableBody(rawHtml), input.sourceUrl);
      const pageTitle = extractTitle(rawHtml, input.title);
      const imageUrls = collectImageUrls(readableBody, input.sourceUrl);
      const imageMap = new Map<string, string>();
      const failedImageUrls = new Set<string>();
      const downloadedAssetUris: string[] = [];

      if (imageUrls.length) {
        await FileSystem.makeDirectoryAsync(assetRoot, { intermediates: true }).catch(
          () => undefined
        );
      }

      await this.updateProgressState(input.id, input.packId, input.localUri, input.title, 0.2);

      for (let index = 0; index < imageUrls.length; index += 1) {
        if (controller.signal.aborted) throw new Error('Download canceled.');
        const imageUrl = imageUrls[index];
        const assetFileName = `${String(index + 1).padStart(2, '0')}-${inferFileName(
          imageUrl,
          'image'
        )}`;
        const destinationUri = `${assetRoot}${assetFileName}`;
        currentAssetDownload = FileSystem.createDownloadResumable(imageUrl, destinationUri, {
          md5: false,
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
          headers: arkDownloadHeaders(),
        });

        try {
          const result = await currentAssetDownload.downloadAsync();
          if (result?.uri && (!result.status || (result.status >= 200 && result.status < 300))) {
            imageMap.set(imageUrl, `assets/${assetFileName}`);
            downloadedAssetUris.push(result.uri);
          } else {
            failedImageUrls.add(imageUrl);
            await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(
              () => undefined
            );
          }
        } catch (downloadError) {
          failedImageUrls.add(imageUrl);
          await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => undefined);
        } finally {
          currentAssetDownload = null;
        }

        const progress = 0.2 + ((index + 1) / Math.max(imageUrls.length, 1)) * 0.65;
        await this.updateProgressState(
          input.id,
          input.packId,
          input.localUri,
          input.title,
          progress
        );
      }

      const strippedBody = stripFailedImageTags(readableBody, input.sourceUrl, failedImageUrls);
      const snapshotHtml = wrapSnapshotHtml({
        title: pageTitle,
        sourceUrl: input.sourceUrl,
        body: rewriteSnapshotContent(strippedBody, input.sourceUrl, imageMap),
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
        title: input.title,
        packId: input.packId,
        resultUri: input.localUri,
        resolvedSizeBytes: totalBytes,
      });
    } catch (error) {
      if (active?.stopReason === 'paused') {
        await DownloadsRepository.updateStatus(input.id, 'paused', active.progress, null);
        await DownloadNotificationService.terminal({
          id: input.id,
          kind: input.kind,
          title: input.title,
          progress: active.progress,
          status: 'paused',
        });
        if (input.packId) {
          await ContentRepository.updateInstallStatus({
            id: input.packId,
            status: 'paused',
            progress: active.progress,
            localUri: input.localUri,
          });
        }
        return;
      }

      if (controller.signal.aborted || active?.stopReason === 'canceled') {
        await DownloadsRepository.updateStatus(input.id, 'canceled', active?.progress ?? 0, null);
        await DownloadNotificationService.terminal({
          id: input.id,
          kind: input.kind,
          title: input.title,
          progress: active?.progress ?? 0,
          status: 'canceled',
        });
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
      await DownloadNotificationService.terminal({
        id: input.id,
        kind: input.kind,
        title: input.title,
        progress: 0,
        status: 'failed',
      });
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
      this.downloadPackIds.delete(input.id);
      this.drainQueueSoon();
    }
  }

  private static async runUserWebSnapshot(input: {
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
        kind: input.kind,
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
      void DownloadNotificationService.progress({
        id: input.id,
        kind: input.kind,
        title: input.title,
        progress: 0,
        status: 'downloading',
      });
      if (input.packId) {
        await ContentRepository.updateInstallStatus({
          id: input.packId,
          status: 'downloading',
          progress: 0,
          localUri: input.localUri,
        });
      }

      await FileSystem.deleteAsync(snapshotRoot, { idempotent: true }).catch(() => undefined);
      await FileSystem.makeDirectoryAsync(snapshotRoot, { intermediates: true }).catch(
        () => undefined
      );
      await this.updateProgressState(input.id, input.packId, input.localUri, input.title, 0.08);

      const response = await fetch(input.sourceUrl, {
        headers: {
          ...arkDownloadHeaders({ accept: SNAPSHOT_ACCEPT_HEADER }),
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);

      const rawHtml = await response.text();
      const { html: defuddleHtml, title: defuddleTitle } = await extractUserWebBody(
        rawHtml,
        input.sourceUrl
      );
      const pageTitle = defuddleTitle || extractTitle(rawHtml, input.title) || input.title;
      const readableBody = filterSnapshotChrome(defuddleHtml, input.sourceUrl);
      const imageUrls = collectImageUrls(readableBody, input.sourceUrl);
      const imageMap = new Map<string, string>();
      const failedImageUrls = new Set<string>();
      const downloadedAssetUris: string[] = [];

      if (imageUrls.length) {
        await FileSystem.makeDirectoryAsync(assetRoot, { intermediates: true }).catch(
          () => undefined
        );
      }

      await this.updateProgressState(input.id, input.packId, input.localUri, input.title, 0.2);

      for (let index = 0; index < imageUrls.length; index += 1) {
        if (controller.signal.aborted) throw new Error('Download canceled.');
        const imageUrl = imageUrls[index];
        const assetFileName = `${String(index + 1).padStart(2, '0')}-${inferFileName(
          imageUrl,
          'image'
        )}`;
        const destinationUri = `${assetRoot}${assetFileName}`;
        currentAssetDownload = FileSystem.createDownloadResumable(imageUrl, destinationUri, {
          md5: false,
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
          headers: arkDownloadHeaders(),
        });

        try {
          const result = await currentAssetDownload.downloadAsync();
          if (result?.uri && (!result.status || (result.status >= 200 && result.status < 300))) {
            imageMap.set(imageUrl, `assets/${assetFileName}`);
            downloadedAssetUris.push(result.uri);
          } else {
            failedImageUrls.add(imageUrl);
            await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(
              () => undefined
            );
          }
        } catch (downloadError) {
          failedImageUrls.add(imageUrl);
          await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => undefined);
        } finally {
          currentAssetDownload = null;
        }

        const progress = 0.2 + ((index + 1) / Math.max(imageUrls.length, 1)) * 0.65;
        await this.updateProgressState(
          input.id,
          input.packId,
          input.localUri,
          input.title,
          progress
        );
      }

      const strippedBody = stripFailedImageTags(readableBody, input.sourceUrl, failedImageUrls);
      const snapshotHtml = wrapSnapshotHtml({
        title: pageTitle,
        sourceUrl: input.sourceUrl,
        body: rewriteSnapshotContent(strippedBody, input.sourceUrl, imageMap),
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
        title: input.title,
        packId: input.packId,
        resultUri: input.localUri,
        resolvedSizeBytes: totalBytes,
      });
    } catch (error) {
      if (active?.stopReason === 'paused') {
        await DownloadsRepository.updateStatus(input.id, 'paused', active.progress, null);
        await DownloadNotificationService.terminal({
          id: input.id,
          kind: input.kind,
          title: input.title,
          progress: active.progress,
          status: 'paused',
        });
        if (input.packId) {
          await ContentRepository.updateInstallStatus({
            id: input.packId,
            status: 'paused',
            progress: active.progress,
            localUri: input.localUri,
          });
        }
        return;
      }

      if (controller.signal.aborted || active?.stopReason === 'canceled') {
        await DownloadsRepository.updateStatus(input.id, 'canceled', active?.progress ?? 0, null);
        await DownloadNotificationService.terminal({
          id: input.id,
          kind: input.kind,
          title: input.title,
          progress: active?.progress ?? 0,
          status: 'canceled',
        });
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
      await DownloadNotificationService.terminal({
        id: input.id,
        kind: input.kind,
        title: input.title,
        progress: 0,
        status: 'failed',
      });
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
      this.downloadPackIds.delete(input.id);
      this.drainQueueSoon();
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
      await DownloadNotificationService.terminal({
        id,
        kind: row.kind,
        title: row.title,
        progress: row.progress,
        status: 'paused',
      });
      const packId = await this.resolvePackIdForDownload(row);
      if (packId && row.localUri) {
        await ContentRepository.updateInstallStatus({
          id: packId,
          status: 'paused',
          progress: row.progress,
          localUri: row.localUri,
        });
      }
      this.drainQueueSoon();
      return;
    }
    if (!active.download) {
      active.stopReason = 'paused';
      if (active.cancel) await withTimeout(active.cancel(), 2500).catch(() => undefined);
      await DownloadsRepository.pause({
        id,
        progress: active.progress || row.progress,
        resumeData: null,
      });
      await DownloadNotificationService.terminal({
        id,
        kind: row.kind,
        title: row.title,
        progress: active.progress || row.progress,
        status: 'paused',
      });
      if (active.packId) {
        await ContentRepository.updateInstallStatus({
          id: active.packId,
          status: 'paused',
          progress: active.progress || row.progress,
          localUri: active.localUri,
        });
      }
      this.drainQueueSoon();
      return;
    }
    active.stopReason = 'paused';
    const pauseState = await withTimeout(active.download.pauseAsync(), 2500).catch(() =>
      active.download?.savable()
    );
    const resumeData = pauseState?.resumeData ?? active.download.savable().resumeData ?? null;
    await DownloadsRepository.pause({
      id,
      progress: active.progress || row.progress,
      resumeData,
    });
    await DownloadNotificationService.terminal({
      id,
      kind: row.kind,
      title: row.title,
      progress: active.progress || row.progress,
      status: 'paused',
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
    if (packId === undefined) this.downloadPackIds.delete(id);
    else this.downloadPackIds.set(id, packId);
    const pausedTooLong =
      typeof row.updatedAt === 'number' && Date.now() - row.updatedAt > RESUME_DATA_MAX_AGE_MS;
    const clearResumeData =
      pausedTooLong || (row.kind === 'guide' && isHtmlSnapshotUri(row.localUri));
    const resumeProgress = clearResumeData ? 0 : row.progress;
    await DownloadsRepository.markQueued({
      id,
      progress: resumeProgress,
      clearResumeData,
    });
    if (pausedTooLong && row.localUri) {
      await FileSystem.deleteAsync(row.localUri, { idempotent: true }).catch(() => undefined);
    }
    this.drainQueueSoon();
  }

  static async cancelDownload(id: string) {
    const row = await DownloadsRepository.get(id);
    if (!row) throw new Error('Download not found.');
    const active = this.activeDownloads.get(id);
    if (active) {
      active.stopReason = 'canceled';
      if (active.cancel) await withTimeout(active.cancel(), 2500).catch(() => undefined);
      else if (active.download)
        await withTimeout(active.download.cancelAsync(), 2500).catch(() => undefined);
    }
    if (row.localUri) {
      const targetUri =
        row.kind === 'guide' && isHtmlSnapshotUri(row.localUri)
          ? parentDirectory(row.localUri)
          : row.localUri;
      await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined);
    }
    await DownloadsRepository.updateStatus(id, 'canceled', 0, null);
    await DownloadNotificationService.terminal({
      id,
      kind: row.kind,
      title: row.title,
      progress: 0,
      status: 'canceled',
    });
    this.downloadPackIds.delete(id);
    this.drainQueueSoon();
  }

  static async pauseAll() {
    const rows = await DownloadsRepository.listByStatuses(['queued', 'downloading', 'verifying']);
    let paused = 0;
    for (const row of rows) {
      try {
        await this.pauseDownload(row.id);
      } catch {
        await DownloadsRepository.updateStatus(row.id, 'paused', row.progress ?? 0, null);
      }
      paused += 1;
    }
    return { paused };
  }

  static async resumeAll() {
    const rows = (await DownloadsRepository.listByStatuses(['paused'])).filter(
      (row) => row.sourceUrl && row.localUri
    );
    for (const row of rows) {
      await this.resumeDownload(row.id, await this.resolvePackIdForDownload(row));
    }
    return { resumed: rows.length };
  }

  static async retryFailed() {
    const rows = (await DownloadsRepository.listByStatuses(['failed'])).filter(
      (row) => row.sourceUrl && row.localUri
    );
    for (const row of rows) {
      await this.resumeDownload(row.id, await this.resolvePackIdForDownload(row));
    }
    return { retried: rows.length };
  }

  static async deleteCompletedWhereSafe() {
    const rows = await DownloadsRepository.listByStatuses(['completed']);
    let deleted = 0;
    let skipped = 0;
    for (const row of rows) {
      if (await this.isProtectedCompletedDownload(row)) {
        skipped += 1;
        continue;
      }
      if (row.localUri) {
        const targetUri =
          row.kind === 'guide' && isHtmlSnapshotUri(row.localUri)
            ? parentDirectory(row.localUri)
            : row.localUri;
        await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined);
      }
      await DownloadsRepository.delete(row.id);
      this.downloadPackIds.delete(row.id);
      deleted += 1;
    }
    return { deleted, skipped };
  }

  private static async isProtectedCompletedDownload(row: DownloadRow) {
    if (row.kind === 'document' || row.kind === 'map') return true;
    if (!row.localUri) return false;
    const packs = await ContentRepository.list({ includeTestOnly: true });
    return packs.some(
      (pack) =>
        pack.localUri === row.localUri &&
        (pack.installed ||
          ['queued', 'downloading', 'verifying', 'paused', 'installed'].includes(
            pack.installStatus
          ))
    );
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
    title: string;
    packId?: string | null;
    resultUri: string;
    expectedChecksumMd5?: string | null;
    expectedChecksumSha256?: string | null;
    expectedSizeBytes?: number | null;
    checksumMd5?: string | null;
    resolvedSizeBytes?: number | null;
  }) {
    this.assertDownloadNotCanceled(input.id);
    await DownloadsRepository.updateStatus(input.id, 'verifying', 1, null);
    await DownloadNotificationService.progress({
      id: input.id,
      kind: input.kind,
      title: input.title,
      progress: 1,
      status: 'verifying',
    });
    if (input.packId) {
      await ContentRepository.updateInstallStatus({
        id: input.packId,
        status: 'verifying',
        progress: 1,
        localUri: input.resultUri,
      });
    }

    this.assertDownloadNotCanceled(input.id);
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
    if (!input.expectedSizeBytes && !input.expectedChecksumMd5 && !input.expectedChecksumSha256) {
      if (!sizeBytes || sizeBytes <= 0) {
        await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
        throw new Error(
          'Downloaded file is empty. The server may have returned a placeholder; retry later.'
        );
      }
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
      this.assertDownloadNotCanceled(input.id);
      const validPdf = await this.hasPdfHeader(input.resultUri);
      if (!validPdf) {
        await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
        throw new Error(
          'Verification failed: the server returned a web page instead of the PDF. Retry later or use another network.'
        );
      }
    }

    if (input.kind === 'zim') {
      this.assertDownloadNotCanceled(input.id);
      const header = await ZimHeaderParser.parse(input.resultUri);
      if (!header.valid) {
        await FileSystem.deleteAsync(input.resultUri, { idempotent: true }).catch(() => undefined);
        throw new Error('Downloaded file is not a valid ZIM archive.');
      }
    }

    let checksumSha256: string | null = null;
    if (input.expectedChecksumSha256) {
      const digest = await FileDigestService.sha256FileIfReasonable(input.resultUri, sizeBytes, {
        shouldCancel: () => this.activeDownloads.get(input.id)?.stopReason === 'canceled',
      });
      this.assertDownloadNotCanceled(input.id);
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
    await DownloadNotificationService.terminal({
      id: input.id,
      kind: input.kind,
      title: input.title,
      progress: 1,
      status: 'completed',
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

  private static assertDownloadNotCanceled(id: string) {
    if (this.activeDownloads.get(id)?.stopReason === 'canceled') {
      throw new Error('Download canceled.');
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
    title: string,
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
    void DownloadNotificationService.progress({
      id,
      kind: active?.kind ?? 'guide',
      title,
      progress: nextProgress,
      status: 'downloading',
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
