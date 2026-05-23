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
  resume_data: string | null;
  expected_checksum_md5: string | null;
  checksum_md5: string | null;
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
    resumeData: row.resume_data,
    expectedChecksumMd5: row.expected_checksum_md5,
    checksumMd5: row.checksum_md5,
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

  static async get(id: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<Parameters<typeof mapDownload>[0]>(
      'SELECT * FROM downloads WHERE id = ?',
      [id]
    );
    return row ? mapDownload(row) : null;
  }

  static async create(input: {
    kind: DownloadKind;
    title: string;
    sourceUrl?: string | null;
    localUri?: string | null;
    expectedChecksumMd5?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO downloads
        (id, kind, title, source_url, local_uri, status, progress, resume_data, expected_checksum_md5, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 0, NULL, ?, ?, ?)`,
      [
        id,
        input.kind,
        input.title,
        input.sourceUrl ?? null,
        input.localUri ?? null,
        input.expectedChecksumMd5 ?? null,
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

  static async pause(input: { id: string; progress: number; resumeData?: string | null }) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE downloads
       SET status = 'paused',
           progress = ?,
           resume_data = COALESCE(?, resume_data),
           updated_at = ?
       WHERE id = ?`,
      [input.progress, input.resumeData ?? null, Date.now(), input.id]
    );
  }

  static async updateProgress(input: {
    id: string;
    progress: number;
    totalBytes?: number | null;
    downloadedBytes?: number | null;
    localUri?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE downloads
       SET status = 'downloading',
           progress = ?,
           total_bytes = COALESCE(?, total_bytes),
           downloaded_bytes = COALESCE(?, downloaded_bytes),
           local_uri = COALESCE(?, local_uri),
           resume_data = NULL,
           error = NULL,
           updated_at = ?
       WHERE id = ?`,
      [
        input.progress,
        input.totalBytes ?? null,
        input.downloadedBytes ?? null,
        input.localUri ?? null,
        Date.now(),
        input.id,
      ]
    );
  }

  static async complete(input: {
    id: string;
    localUri: string;
    totalBytes?: number | null;
    downloadedBytes?: number | null;
    checksumMd5?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE downloads
       SET status = 'completed',
           progress = 1,
           local_uri = ?,
           total_bytes = COALESCE(?, total_bytes),
           downloaded_bytes = COALESCE(?, downloaded_bytes),
           checksum_md5 = COALESCE(?, checksum_md5),
           error = NULL,
           updated_at = ?
       WHERE id = ?`,
      [
        input.localUri,
        input.totalBytes ?? null,
        input.downloadedBytes ?? input.totalBytes ?? null,
        input.checksumMd5 ?? null,
        Date.now(),
        input.id,
      ]
    );
  }
}
