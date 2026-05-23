import { DatabaseClient } from '@/services/db/client';
import type { ArkDocument } from '@/types/db';

function now() {
  return Date.now();
}

function rowToDocument(row: {
  id: string;
  title: string;
  mime_type: string | null;
  local_uri: string | null;
  size_bytes: number | null;
  sha256: string | null;
  source: string | null;
  is_personal: number;
  encryption_status: ArkDocument['encryptionStatus'];
  created_at: number;
  updated_at: number;
}): ArkDocument {
  return {
    id: row.id,
    title: row.title,
    mimeType: row.mime_type,
    localUri: row.local_uri,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    source: row.source,
    isPersonal: !!row.is_personal,
    encryptionStatus: row.encryption_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DocumentsRepository {
  static async list() {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof rowToDocument>[0]>(
      'SELECT * FROM documents ORDER BY updated_at DESC'
    );
    return rows.map(rowToDocument);
  }

  static async get(id: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<Parameters<typeof rowToDocument>[0]>(
      'SELECT * FROM documents WHERE id = ?',
      [id]
    );
    return row ? rowToDocument(row) : null;
  }

  static async create(input: {
    id: string;
    title: string;
    mimeType?: string | null;
    localUri?: string | null;
    sizeBytes?: number | null;
    sha256?: string | null;
    source?: string | null;
    encryptionStatus?: ArkDocument['encryptionStatus'];
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = now();
    await db.runAsync(
      `INSERT INTO documents
        (id, title, mime_type, local_uri, size_bytes, sha256, source, is_personal, encryption_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        input.id,
        input.title,
        input.mimeType ?? null,
        input.localUri ?? null,
        input.sizeBytes ?? null,
        input.sha256 ?? null,
        input.source ?? null,
        input.encryptionStatus ?? 'plaintext',
        timestamp,
        timestamp,
      ]
    );
    return this.get(input.id);
  }

  static async delete(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
  }
}
