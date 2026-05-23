import { STARTER_PACKS } from '@/constants/packs';
import { DatabaseClient } from '@/services/db/client';
import type { ContentPack } from '@/types/content';

const LEGACY_PLACEHOLDER_PACK_IDS = [
  'first-aid-basics',
  'survival-basics',
  'emergency-medicine',
  'portugal-weather-cache',
  'local-map-region',
  'simple-wikipedia-zim-placeholder',
  'wikivoyage-portugal-placeholder',
  'mushrooms-safety-placeholder',
];

function now() {
  return Date.now();
}

function rowToPack(row: {
  id: string;
  title: string;
  description: string | null;
  category: ContentPack['category'];
  source_url: string | null;
  local_uri: string | null;
  format: ContentPack['format'];
  size_bytes: number | null;
  checksum_md5: string | null;
  installed: number;
  install_status: ContentPack['installStatus'];
  progress: number;
  created_at: number;
  updated_at: number;
}): ContentPack {
  const manifest = STARTER_PACKS.find((pack) => pack.id === row.id);
  const customModel = row.id.startsWith('custom-model-');
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category,
    format: row.format,
    estimatedSize:
      manifest?.estimatedSize ??
      (row.size_bytes ? `${Math.round(row.size_bytes / 1024 / 1024)} MB` : 'Unknown'),
    sourceUrl: row.source_url ?? undefined,
    sourceLabel: manifest?.sourceLabel ?? (customModel ? 'Local model' : undefined),
    fileName: manifest?.fileName ?? row.local_uri?.split('/').pop(),
    checksumMd5: row.checksum_md5 ?? manifest?.checksumMd5 ?? null,
    localUri: row.local_uri,
    sizeBytes: row.size_bytes,
    installed: !!row.installed,
    installStatus: row.install_status,
    progress: row.progress,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    disclaimer: manifest?.disclaimer,
  };
}

export class ContentRepository {
  static async seedStarterPacks() {
    const db = await DatabaseClient.getDb();
    const timestamp = now();
    for (const id of LEGACY_PLACEHOLDER_PACK_IDS) {
      await db.runAsync('DELETE FROM content_packs WHERE id = ?', [id]);
    }
    for (const pack of STARTER_PACKS) {
      await db.runAsync(
        `INSERT OR IGNORE INTO content_packs
          (id, title, description, category, language, source_url, format, checksum_md5, installed, install_status, progress, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'en', ?, ?, ?, 0, 'not_installed', 0, ?, ?)`,
        [
          pack.id,
          pack.title,
          pack.description,
          pack.category,
          pack.sourceUrl ?? null,
          pack.format,
          pack.checksumMd5 ?? null,
          timestamp,
          timestamp,
        ]
      );
      await db.runAsync(
        `UPDATE content_packs
         SET title = ?,
             description = ?,
             category = ?,
             language = 'en',
             source_url = ?,
             format = ?,
             checksum_md5 = COALESCE(?, checksum_md5),
             size_bytes = COALESCE(size_bytes, ?),
             updated_at = ?
         WHERE id = ?`,
        [
          pack.title,
          pack.description,
          pack.category,
          pack.sourceUrl ?? null,
          pack.format,
          pack.checksumMd5 ?? null,
          pack.sizeBytes ?? null,
          timestamp,
          pack.id,
        ]
      );
    }
  }

  static async list() {
    await this.seedStarterPacks();
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof rowToPack>[0]>(
      'SELECT * FROM content_packs ORDER BY category, title'
    );
    return rows.map(rowToPack);
  }

  static async updateInstallStatus(input: {
    id: string;
    status: ContentPack['installStatus'];
    progress?: number;
    localUri?: string | null;
    sizeBytes?: number | null;
  }) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE content_packs
       SET installed = ?,
           install_status = ?,
           progress = ?,
           local_uri = COALESCE(?, local_uri),
           size_bytes = COALESCE(?, size_bytes),
           updated_at = ?
       WHERE id = ?`,
      [
        input.status === 'installed' ? 1 : 0,
        input.status,
        input.progress ?? 0,
        input.localUri ?? null,
        input.sizeBytes ?? null,
        now(),
        input.id,
      ]
    );
  }

  static async createPack(input: {
    id: string;
    title: string;
    description: string;
    category: ContentPack['category'];
    format: ContentPack['format'];
    sourceUrl?: string | null;
    localUri?: string | null;
    sizeBytes?: number | null;
    checksumMd5?: string | null;
    installed?: boolean;
    installStatus?: ContentPack['installStatus'];
    progress?: number;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = now();
    await db.runAsync(
      `INSERT OR REPLACE INTO content_packs
        (id, title, description, category, language, source_url, local_uri, format, size_bytes, checksum_md5, installed, install_status, progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'en', ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM content_packs WHERE id = ?), ?), ?)`,
      [
        input.id,
        input.title,
        input.description,
        input.category,
        input.sourceUrl ?? null,
        input.localUri ?? null,
        input.format,
        input.sizeBytes ?? null,
        input.checksumMd5 ?? null,
        input.installed ? 1 : 0,
        input.installStatus ?? (input.installed ? 'installed' : 'not_installed'),
        input.progress ?? (input.installed ? 1 : 0),
        input.id,
        timestamp,
        timestamp,
      ]
    );
  }

  static async uninstall(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE content_packs
       SET installed = 0,
           install_status = 'not_installed',
           progress = 0,
           local_uri = NULL,
           updated_at = ?
       WHERE id = ?`,
      [now(), id]
    );
  }

  static async delete(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('DELETE FROM content_packs WHERE id = ?', [id]);
  }
}
