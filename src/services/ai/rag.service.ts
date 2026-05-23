import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { chunkText, estimateTokens } from '@/services/ai/chunking';
import {
  RAG_HASH_EMBEDDING_MODEL_ID,
  cosineSimilarity,
  deserializeEmbedding,
  embedText,
  serializeEmbedding,
} from '@/services/ai/rag-embedding';
import { RagVectorService } from '@/services/ai/rag-vector.service';
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
      const oldChunks = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM rag_chunks WHERE source_id = ?',
        [input.id]
      );
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
      await RagVectorService.removeChunks(
        db,
        oldChunks.map((chunk) => chunk.id)
      );
      await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [input.id]);
      for (let index = 0; index < input.chunks.length; index += 1) {
        const text = input.chunks[index];
        const id = randomUUID();
        const embedding = serializeEmbedding(embedText(text));
        await db.runAsync(
          `INSERT INTO rag_chunks
            (id, source_id, chunk_index, text, token_count, embedding_model_id, embedding_blob, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.id,
            index,
            text,
            estimateTokens(text),
            RAG_HASH_EMBEDDING_MODEL_ID,
            embedding,
            timestamp,
          ]
        );
        await db.runAsync(
          'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
          [id, text, input.title]
        );
        await RagVectorService.upsertChunk(db, { chunkId: id, embedding });
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
    const embedding = serializeEmbedding(embedText(text));
    await db.runAsync(
      `INSERT INTO rag_sources (id, kind, source_ref, title, created_at, updated_at)
       VALUES (?, 'guide', 'starter', 'Ark starter guide', ?, ?)`,
      [sourceId, timestamp, timestamp]
    );
    await db.runAsync(
      `INSERT INTO rag_chunks
        (id, source_id, chunk_index, text, token_count, embedding_model_id, embedding_blob, created_at)
       VALUES (?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        chunkId,
        sourceId,
        text,
        estimateTokens(text),
        RAG_HASH_EMBEDDING_MODEL_ID,
        embedding,
        timestamp,
      ]
    );
    await db.runAsync(
      'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
      [chunkId, text, 'Ark starter guide']
    );
    await RagVectorService.upsertChunk(db, { chunkId, embedding });
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
      kind: string;
      chunk_index: number;
      embedding_blob: unknown;
    }> = [];
    const limit = options.limit ?? 4;
    for (const fts of ftsQueries) {
      rows = await db.getAllAsync<(typeof rows)[number]>(
        `SELECT f.chunk_id,
                f.text,
                f.source_title,
                c.source_id,
                c.chunk_index,
                c.embedding_blob,
                s.source_ref,
                s.kind
         FROM rag_chunks_fts f
         JOIN rag_chunks c ON c.id = f.chunk_id
         JOIN rag_sources s ON s.id = c.source_id
         WHERE rag_chunks_fts MATCH ?
         ORDER BY bm25(rag_chunks_fts)
         LIMIT ?`,
        [fts, Math.max(limit * 4, 12)]
      );
      if (rows.length) break;
    }
    return rankRows(query, rows)
      .slice(0, limit)
      .map((row) => ({
        ...citationForRow(row),
        snippet: snippetForRow(row),
      }));
  }
}

function rankRows<T extends { embedding_blob: unknown }>(query: string, rows: T[]) {
  const queryEmbedding = embedText(query);
  return rows
    .map((row, index) => {
      const embedding = deserializeEmbedding(row.embedding_blob);
      return {
        row,
        index,
        score: embedding ? cosineSimilarity(queryEmbedding, embedding) : Number.NEGATIVE_INFINITY,
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.row);
}

function citationForRow(row: {
  source_id: string;
  source_title: string;
  source_ref: string;
  kind: string;
  chunk_index: number;
}) {
  const section =
    row.kind === 'guide' || row.kind === 'zim'
      ? GuideService.getSections(row.source_ref)[row.chunk_index]
      : null;
  const contentTarget =
    row.source_id.startsWith('content:') && row.source_ref
      ? `/content/${encodeURIComponent(row.source_ref)}${
          section?.title ? `?section=${encodeURIComponent(section.title)}` : ''
        }`
      : undefined;

  return {
    sourceId: row.source_id,
    title: row.source_title,
    sourceRef: row.source_ref,
    sectionTitle: section?.title,
    page: section?.page,
    targetHref: contentTarget,
  };
}

function snippetForRow(row: {
  source_ref: string;
  kind: string;
  chunk_index: number;
  text: string;
}) {
  const section =
    row.kind === 'guide' || row.kind === 'zim'
      ? GuideService.getSections(row.source_ref)[row.chunk_index]
      : null;
  if (section?.detail) return section.detail;
  return row.text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?.slice(0, 240) ?? row.text.slice(0, 240);
}
