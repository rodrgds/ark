import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { chunkText, estimateTokens } from '@/services/ai/chunking';
import { GuideService } from '@/services/content/guide.service';
import type { AiCitation } from '@/types/ai';
import type { ContentPack } from '@/types/content';

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'before',
  'can',
  'do',
  'for',
  'how',
  'i',
  'in',
  'is',
  'it',
  'my',
  'of',
  'or',
  'should',
  'the',
  'to',
  'what',
  'when',
  'where',
  'with',
]);

function tokenizeForFts(query: string) {
  return query
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9_'-]/g, '').trim())
    .filter(Boolean);
}

function toFtsQueries(query: string) {
  const terms = tokenizeForFts(query);
  const meaningful = terms.filter((term) => term.length > 2 && !STOPWORDS.has(term.toLowerCase()));
  const precise = terms.map((part) => `${part}*`).join(' ');
  const fallback = meaningful.map((part) => `${part}*`).join(' OR ');
  return Array.from(new Set([precise, fallback].filter(Boolean)));
}

export class RagService {
  private static async replaceSource(input: {
    id: string;
    kind: string;
    sourceRef: string;
    title: string;
    chunks: string[];
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO rag_sources (id, kind, source_ref, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind,
           source_ref = excluded.source_ref,
           title = excluded.title,
           updated_at = excluded.updated_at`,
        [input.id, input.kind, input.sourceRef, input.title, timestamp, timestamp]
      );
      await db.runAsync(
        'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
        [input.id]
      );
      await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [input.id]);
      for (let index = 0; index < input.chunks.length; index += 1) {
        const text = input.chunks[index];
        const id = randomUUID();
        await db.runAsync(
          `INSERT INTO rag_chunks (id, source_id, chunk_index, text, token_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, input.id, index, text, estimateTokens(text), timestamp]
        );
        await db.runAsync(
          'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
          [id, text, input.title]
        );
      }
    });
  }

  static async indexNote(noteId: string) {
    const note = await NotesRepository.get(noteId);
    if (!note) return;
    const sourceId = `note:${note.id}`;
    await this.replaceSource({
      id: sourceId,
      kind: 'note',
      sourceRef: note.id,
      title: note.title,
      chunks: chunkText(`${note.title}\n${note.body}\n${note.tags.join(' ')}`),
    });
  }

  static buildContentChunks(pack: ContentPack) {
    const sections = GuideService.getSections(pack.id);
    const header = [
      `${pack.title}.`,
      pack.description,
      `Category: ${pack.category}. Format: ${pack.format}. Size: ${pack.estimatedSize}.`,
      pack.sourceLabel ? `Source: ${pack.sourceLabel}.` : '',
      pack.installed ? 'Installed offline.' : 'Available for download.',
    ]
      .filter(Boolean)
      .join('\n');

    if (sections.length) {
      return sections.map((section) =>
        [
          header,
          `Section: ${section.title}.`,
          section.detail,
          section.page ? `Reader page target: ${section.page}.` : '',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    return chunkText(header);
  }

  static async indexContentPack(packId: string) {
    const pack = (await ContentRepository.list()).find((item) => item.id === packId);
    if (!pack) return;
    await this.replaceSource({
      id: `content:${pack.id}`,
      kind: pack.format === 'zim' ? 'zim' : pack.category === 'AI Models' ? 'model' : 'guide',
      sourceRef: pack.id,
      title: pack.title,
      chunks: this.buildContentChunks(pack),
    });
  }

  static async indexInstalledContentPacks() {
    const packs = await ContentRepository.list();
    for (const pack of packs.filter((item) => item.installed)) {
      await this.indexContentPack(pack.id);
    }
  }

  static async removeSource(sourceId: string) {
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
        [sourceId]
      );
      await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [sourceId]);
      await db.runAsync('DELETE FROM rag_sources WHERE id = ?', [sourceId]);
    });
  }

  static async seedCoreContent() {
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
    await this.seedCoreContent();
    await this.indexInstalledContentPacks();
    const ftsQueries = toFtsQueries(query);
    if (!ftsQueries.length) return [];
    const db = await DatabaseClient.getDb();
    let rows: Array<{
      chunk_id: string;
      text: string;
      source_title: string;
      source_id: string;
      source_ref: string;
    }> = [];
    for (const fts of ftsQueries) {
      rows = await db.getAllAsync<(typeof rows)[number]>(
        `SELECT f.chunk_id, f.text, f.source_title, c.source_id, s.source_ref
         FROM rag_chunks_fts f
         JOIN rag_chunks c ON c.id = f.chunk_id
         JOIN rag_sources s ON s.id = c.source_id
         WHERE rag_chunks_fts MATCH ?
         LIMIT ?`,
        [fts, options.limit ?? 4]
      );
      if (rows.length) break;
    }
    return rows.map((row) => ({
      sourceId: row.source_id,
      title: row.source_title,
      snippet: row.text.slice(0, 240),
      sourceRef: row.source_ref,
    }));
  }
}
