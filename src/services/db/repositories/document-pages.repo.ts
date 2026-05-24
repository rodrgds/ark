import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import type { DocumentPage } from '@/types/db';

function now() {
  return Date.now();
}

function rowToPage(row: {
  id: string;
  document_id: string;
  page_number: number;
  text: string | null;
  extraction_method: DocumentPage['extractionMethod'];
  confidence: number | null;
  indexed_at: number | null;
  created_at: number;
}): DocumentPage {
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    text: row.text ?? '',
    extractionMethod: row.extraction_method,
    confidence: row.confidence,
    indexedAt: row.indexed_at,
    createdAt: row.created_at,
  };
}

export class DocumentPagesRepository {
  static async listForDocument(documentId: string) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof rowToPage>[0]>(
      'SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_number ASC',
      [documentId]
    );
    return rows.map(rowToPage);
  }

  static async replaceForDocument(
    documentId: string,
    title: string,
    pages: Array<{
      pageNumber: number;
      text: string;
      extractionMethod: DocumentPage['extractionMethod'];
      confidence?: number | null;
    }>
  ) {
    const db = await DatabaseClient.getDb();
    const timestamp = now();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM document_pages_fts WHERE document_id = ?', [documentId]);
      await db.runAsync('DELETE FROM document_pages WHERE document_id = ?', [documentId]);
      for (const page of pages) {
        const id = randomUUID();
        const text = page.text.trim();
        await db.runAsync(
          `INSERT INTO document_pages
            (id, document_id, page_number, text, extraction_method, confidence, indexed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
          [
            id,
            documentId,
            page.pageNumber,
            text,
            page.extractionMethod,
            page.confidence ?? null,
            timestamp,
          ]
        );
        if (text) {
          await db.runAsync(
            'INSERT INTO document_pages_fts (page_id, document_id, text, title) VALUES (?, ?, ?, ?)',
            [id, documentId, text, title]
          );
        }
      }
    });
    return this.listForDocument(documentId);
  }

  static async updateDocumentTitle(documentId: string, title: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE document_pages_fts SET title = ? WHERE document_id = ?', [
      title,
      documentId,
    ]);
  }

  static async deleteForDocument(documentId: string) {
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM document_pages_fts WHERE document_id = ?', [documentId]);
      await db.runAsync('DELETE FROM document_pages WHERE document_id = ?', [documentId]);
    });
  }
}
