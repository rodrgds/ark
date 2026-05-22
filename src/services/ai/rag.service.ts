import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { chunkText, estimateTokens } from '@/services/ai/chunking';
import type { AiCitation } from '@/types/ai';

function toFtsQuery(query: string) {
  return query
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9_'-]/g, '').trim())
    .filter(Boolean)
    .map((part) => `${part}*`)
    .join(' ');
}

export class RagService {
  static async indexNote(noteId: string) {
    const note = await NotesRepository.get(noteId);
    if (!note) return;
    const db = await DatabaseClient.getDb();
    const sourceId = `note:${note.id}`;
    const timestamp = Date.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO rag_sources (id, kind, source_ref, title, created_at, updated_at)
         VALUES (?, 'note', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
        [sourceId, note.id, note.title, timestamp, timestamp]
      );
      await db.runAsync(
        'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
        [sourceId]
      );
      await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [sourceId]);
      const chunks = chunkText(`${note.title}\n${note.body}\n${note.tags.join(' ')}`);
      for (let index = 0; index < chunks.length; index += 1) {
        const id = randomUUID();
        await db.runAsync(
          `INSERT INTO rag_chunks (id, source_id, chunk_index, text, token_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, sourceId, index, chunks[index], estimateTokens(chunks[index]), timestamp]
        );
        await db.runAsync(
          'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
          [id, chunks[index], note.title]
        );
      }
    });
  }

  static async seedMockContent() {
    const db = await DatabaseClient.getDb();
    const exists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM rag_sources WHERE id = ?',
      ['guide:starter']
    );
    if (exists) return;
    const sourceId = 'guide:starter';
    const chunkId = randomUUID();
    const timestamp = Date.now();
    const text =
      'Ark starter guide: keep downloaded maps, first aid references, emergency contacts, weather cache, and private notes available before going offline.';
    await db.runAsync(
      `INSERT INTO rag_sources (id, kind, source_ref, title, created_at, updated_at)
       VALUES (?, 'guide', 'starter', 'Ark starter guide', ?, ?)`,
      [sourceId, timestamp, timestamp]
    );
    await db.runAsync(
      `INSERT INTO rag_chunks (id, source_id, chunk_index, text, token_count, created_at)
       VALUES (?, ?, 0, ?, ?, ?)`,
      [chunkId, sourceId, text, estimateTokens(text), timestamp]
    );
    await db.runAsync(
      'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
      [chunkId, text, 'Ark starter guide']
    );
  }

  static async search(query: string, options: { limit?: number } = {}): Promise<AiCitation[]> {
    await this.seedMockContent();
    const fts = toFtsQuery(query);
    if (!fts) return [];
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<{
      chunk_id: string;
      text: string;
      source_title: string;
      source_id: string;
    }>(
      `SELECT f.chunk_id, f.text, f.source_title, c.source_id
       FROM rag_chunks_fts f
       JOIN rag_chunks c ON c.id = f.chunk_id
       WHERE rag_chunks_fts MATCH ?
       LIMIT ?`,
      [fts, options.limit ?? 4]
    );
    return rows.map((row) => ({
      sourceId: row.source_id,
      title: row.source_title,
      snippet: row.text.slice(0, 240),
    }));
  }
}
