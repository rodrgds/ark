import { STARTER_PACKS } from '@/constants/packs';
import { DatabaseClient } from '@/services/db/client';
import type { ContentPack } from '@/types/content';

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
  installed: number;
  install_status: ContentPack['installStatus'];
  progress: number;
  created_at: number;
  updated_at: number;
}): ContentPack {
  const manifest = STARTER_PACKS.find((pack) => pack.id === row.id);
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
    for (const pack of STARTER_PACKS) {
      await db.runAsync(
        `INSERT OR IGNORE INTO content_packs
          (id, title, description, category, language, source_url, format, installed, install_status, progress, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'en', ?, ?, 0, 'not_installed', 0, ?, ?)`,
        [
          pack.id,
          pack.title,
          pack.description,
          pack.category,
          pack.sourceUrl ?? null,
          pack.format,
          timestamp,
          timestamp,
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

  static async setMockInstalled(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE content_packs
       SET installed = 1, install_status = 'installed', progress = 1, updated_at = ?
       WHERE id = ?`,
      [now(), id]
    );
  }
}
