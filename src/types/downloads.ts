export type DownloadKind = 'map' | 'zim' | 'guide' | 'model' | 'rss' | 'weather' | 'document';
export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled';

export type DownloadRow = {
  id: string;
  kind: DownloadKind;
  title: string;
  sourceUrl?: string | null;
  localUri?: string | null;
  status: DownloadStatus;
  progress: number;
  totalBytes?: number | null;
  downloadedBytes?: number | null;
  resumeData?: string | null;
  expectedChecksumMd5?: string | null;
  checksumMd5?: string | null;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
};
