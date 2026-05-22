import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import type { DownloadKind, DownloadRow, DownloadStatus } from '@/types/downloads';

function mapDownload(row: {
  id: string;
  kind: DownloadKind;
  title: string;
  source_url: string | null;
  local_uri: string | null;
  status: DownloadStatus;
  progress: number;
  total_bytes: number | null;
  downloaded_bytes: number | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}): DownloadRow {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    sourceUrl: row.source_url,
    localUri: row.local_uri,
    status: row.status,
    progress: row.progress,
    totalBytes: row.total_bytes,
    downloadedBytes: row.downloaded_bytes,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DownloadsRepository {
  static async list() {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof mapDownload>[0]>(
      'SELECT * FROM downloads ORDER BY updated_at DESC'
    );
    return rows.map(mapDownload);
  }

  static async create(input: {
    kind: DownloadKind;
    title: string;
    sourceUrl?: string | null;
    localUri?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO downloads
        (id, kind, title, source_url, local_uri, status, progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?)`,
      [
        id,
        input.kind,
        input.title,
        input.sourceUrl ?? null,
        input.localUri ?? null,
        timestamp,
        timestamp,
      ]
    );
    return id;
  }

  static async updateStatus(
    id: string,
    status: DownloadStatus,
    progress = 0,
    error?: string | null
  ) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      'UPDATE downloads SET status = ?, progress = ?, error = ?, updated_at = ? WHERE id = ?',
      [status, progress, error ?? null, Date.now(), id]
    );
  }
}
