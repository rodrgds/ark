import { DatabaseClient } from '@/services/db/client';
import { sqliteBoolean } from '@/services/db/sqlite-values';
import { RagCleanupService } from '@/services/ai/rag-cleanup.service';
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
  extracted_text: string | null;
  ocr_text: string | null;
  ocr_status: ArkDocument['ocrStatus'];
  ocr_error: string | null;
  indexed_at: number | null;
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
    isPersonal: sqliteBoolean(row.is_personal),
    encryptionStatus: row.encryption_status,
    extractedText: row.extracted_text,
    ocrText: row.ocr_text,
    ocrStatus: row.ocr_status,
    ocrError: row.ocr_error,
    indexedAt: row.indexed_at,
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
    ocrStatus?: ArkDocument['ocrStatus'];
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = now();
    await db.runAsync(
      `INSERT INTO documents
        (id, title, mime_type, local_uri, size_bytes, sha256, source, is_personal, encryption_status, ocr_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        input.id,
        input.title,
        input.mimeType ?? null,
        input.localUri ?? null,
        input.sizeBytes ?? null,
        input.sha256 ?? null,
        input.source ?? null,
        input.encryptionStatus ?? 'plaintext',
        input.ocrStatus ?? 'not_needed',
        timestamp,
        timestamp,
      ]
    );
    return this.get(input.id);
  }

  static async updateText(
    id: string,
    input: {
      extractedText?: string | null;
      ocrText?: string | null;
      ocrStatus?: ArkDocument['ocrStatus'];
      ocrError?: string | null;
      indexedAt?: number | null;
    }
  ) {
    const db = await DatabaseClient.getDb();
    const current = await this.get(id);
    if (!current) return null;
    const timestamp = now();
    await db.runAsync(
      `UPDATE documents
       SET extracted_text = ?,
           ocr_text = ?,
           ocr_status = ?,
           ocr_error = ?,
           indexed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        input.extractedText === undefined ? current.extractedText : input.extractedText,
        input.ocrText === undefined ? current.ocrText : input.ocrText,
        input.ocrStatus ?? current.ocrStatus,
        input.ocrError === undefined ? current.ocrError : input.ocrError,
        input.indexedAt === undefined ? current.indexedAt : input.indexedAt,
        timestamp,
        id,
      ]
    );
    return this.get(id);
  }

  static async updateTitle(id: string, title: string) {
    const normalized = title.trim();
    if (!normalized) throw new Error('Document name is required.');
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?', [
      normalized,
      now(),
      id,
    ]);
    return this.get(id);
  }

  static async markIndexed(id: string, indexedAt = now()) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE documents SET indexed_at = ? WHERE id = ?', [indexedAt, id]);
  }

  static async delete(id: string) {
    const db = await DatabaseClient.getDb();
    await RagCleanupService.removeSource(`document:${id}`);
    await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
  }
}
