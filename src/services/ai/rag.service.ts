import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { DatabaseClient } from '@/services/db/client';
import { toFtsPrefixQueries } from '@/services/db/fts';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { DocumentsRepository } from '@/services/db/repositories/documents.repo';
import { DocumentPagesRepository } from '@/services/db/repositories/document-pages.repo';
import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { RssRepository } from '@/services/db/repositories/rss.repo';
import { chunkText, estimateTokens } from '@/services/ai/chunking';
import {
  RAG_HASH_EMBEDDING_MODEL_ID,
  cosineSimilarity,
  deserializeEmbedding,
  deserializeEmbeddingWithDimensions,
  embedText,
  serializeEmbedding,
} from '@/services/ai/rag-embedding';
import { RagVectorService } from '@/services/ai/rag-vector.service';
import { EmbeddingService, type EmbeddingResult } from '@/services/ai/embedding.service';
import { GuideService } from '@/services/content/guide.service';
import { ZimService, type ZimArticle, type ZimSearchResult } from '@/services/content/zim.service';
import { OcrService } from '@/services/ocr/ocr.service';
import type { AiCitation } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';
import type { DocumentPage } from '@/types/db';

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

function toFtsQueries(query: string) {
  return toFtsPrefixQueries(query, { stopwords: STOPWORDS, meaningfulMinLength: 3 });
}

export class RagService {
  private static sourceWriteQueue: Promise<unknown> = Promise.resolve();

  private static async queueSourceWrite<T>(operation: () => Promise<T>) {
    const next = this.sourceWriteQueue.then(operation, operation);
    this.sourceWriteQueue = next.catch(() => undefined);
    return next;
  }

  private static async replaceSource(input: {
    id: string;
    kind: string;
    sourceRef: string;
    title: string;
    chunks: string[];
  }) {
    const timestamp = Date.now();
    const embeddedChunks: Array<{
      text: string;
      embeddingResult: EmbeddingResult;
      embedding: Uint8Array;
    }> = [];
    for (const text of input.chunks) {
      const embeddingResult = await EmbeddingService.embedDocument(text);
      embeddedChunks.push({
        text,
        embeddingResult,
        embedding: serializeEmbedding(embeddingResult.vector),
      });
    }
    await this.queueSourceWrite(async () => {
      const db = await DatabaseClient.getDb();
      const oldChunks = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM rag_chunks WHERE source_id = ?',
        [input.id]
      );
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
        await RagVectorService.removeChunks(
          db,
          oldChunks.map((chunk) => chunk.id)
        );
        await db.runAsync(
          'DELETE FROM chunk_embeddings WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
          [input.id]
        );
        await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [input.id]);
        for (let index = 0; index < embeddedChunks.length; index += 1) {
          const { text, embeddingResult, embedding } = embeddedChunks[index];
          const id = randomUUID();
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
              embeddingResult.modelId,
              embedding,
              timestamp,
            ]
          );
          await db.runAsync(
            `INSERT OR REPLACE INTO chunk_embeddings
              (chunk_id, model_id, dimension, embedding_blob, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [id, embeddingResult.modelId, embeddingResult.dimensions, embedding, timestamp]
          );
          await db.runAsync(
            'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
            [id, text, input.title]
          );
          await RagVectorService.upsertChunk(db, {
            chunkId: id,
            embedding,
            modelId: embeddingResult.modelId,
          });
        }
      });
    });
  }

  static async indexNote(noteId: string) {
    const note = await NotesRepository.get(noteId);
    if (!note) return;
    const sourceId = `note:${note.id}`;
    if (!(await this.shouldReindexSource(sourceId, note.updatedAt))) return;
    await this.replaceSource({
      id: sourceId,
      kind: 'note',
      sourceRef: note.id,
      title: note.title,
      chunks: chunkText(`${note.title}\n${note.body}\n${note.tags.join(' ')}`),
    });
  }

  static async indexNotes() {
    const notes = await NotesRepository.list();
    const activeSourceIds = new Set(notes.map((note) => `note:${note.id}`));
    const db = await DatabaseClient.getDb();
    const indexedNoteSources = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM rag_sources WHERE kind = 'note'"
    );
    for (const source of indexedNoteSources) {
      if (!activeSourceIds.has(source.id)) await this.removeSource(source.id);
    }
    for (const note of notes) {
      await this.indexNote(note.id);
    }
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
    if (pack.category === 'AI Models') return;
    if (!(await this.shouldReindexSource(`content:${pack.id}`, pack.updatedAt))) return;
    await this.replaceSource({
      id: `content:${pack.id}`,
      kind: pack.format === 'zim' ? 'zim' : 'guide',
      sourceRef: pack.id,
      title: pack.title,
      chunks: await this.buildPackChunks(pack),
    });
  }

  static async indexInstalledContentPacks() {
    const packs = await ContentRepository.list();
    for (const pack of packs.filter((item) => item.installed && item.category !== 'AI Models')) {
      await this.indexContentPack(pack.id);
    }
  }

  static buildDocumentChunks(document: ArkDocument, pages: DocumentPage[] = []) {
    if (pages.length) {
      return pages.flatMap((page) =>
        chunkText(
          [
            `Document: ${document.title}.`,
            document.mimeType ? `Type: ${document.mimeType}.` : '',
            `Page: ${page.pageNumber}. Extraction: ${page.extractionMethod}.`,
            page.text,
          ]
            .filter(Boolean)
            .join('\n')
        )
      );
    }
    const text = [
      `Document: ${document.title}.`,
      document.mimeType ? `Type: ${document.mimeType}.` : '',
      document.extractedText,
      document.ocrText ? `Text found in attached image:\n${document.ocrText}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return chunkText(text);
  }

  static async indexDocument(documentId: string) {
    const document = await DocumentsRepository.get(documentId);
    if (!document) return;
    const pages = await DocumentPagesRepository.listForDocument(document.id);
    await this.replaceSource({
      id: `document:${document.id}`,
      kind: 'document',
      sourceRef: document.id,
      title: document.title,
      chunks: this.buildDocumentChunks(document, pages),
    });
    await DocumentsRepository.markIndexed(document.id);
  }

  static async indexImportedDocuments() {
    const documents = await DocumentsRepository.list();
    for (const document of documents) {
      if (document.indexedAt && document.indexedAt >= document.updatedAt) continue;
      await this.indexDocument(document.id);
    }
  }

  static async indexRssItems() {
    const items = await RssRepository.listRecentItems(50);
    for (const item of items) {
      if (!(await this.shouldReindexSource(`rss:${item.id}`, item.created_at))) continue;
      await this.replaceSource({
        id: `rss:${item.id}`,
        kind: 'rss',
        sourceRef: item.id,
        title: `${item.feed_title}: ${item.title}`,
        chunks: chunkText(
          [
            `Feed: ${item.feed_title}.`,
            `Headline: ${item.title}.`,
            item.published_at ? `Published: ${new Date(item.published_at).toISOString()}.` : '',
            item.summary,
            item.content,
            item.url ? `Source URL: ${item.url}.` : '',
          ]
            .filter(Boolean)
            .join('\n')
        ),
      });
    }
  }

  static async indexMapData() {
    const [markers, routes, regions] = await Promise.all([
      MapsRepository.listMarkers(),
      MapsRepository.listRoutes(),
      MapsRepository.listRegions(),
    ]);
    const activeSourceIds = new Set([
      ...markers.map((marker) => `map-marker:${marker.id}`),
      ...routes.map((route) => `map-route:${route.id}`),
      ...regions.map((region) => `map-region:${region.id}`),
    ]);
    await this.removeMissingSources(['map_marker', 'map_route', 'map_region'], activeSourceIds);

    for (const marker of markers) {
      if (!(await this.shouldReindexSource(`map-marker:${marker.id}`, marker.updatedAt))) continue;
      await this.replaceSource({
        id: `map-marker:${marker.id}`,
        kind: 'map_marker',
        sourceRef: marker.id,
        title: `Saved spot: ${marker.title}`,
        chunks: chunkText(
          [
            `Saved map spot: ${marker.title}.`,
            marker.description,
            `Coordinates: ${marker.latitude.toFixed(5)}, ${marker.longitude.toFixed(5)}.`,
            marker.photoUri ? 'A local photo is attached to this spot.' : '',
          ]
            .filter(Boolean)
            .join('\n')
        ),
      });
    }

    for (const route of routes) {
      if (!(await this.shouldReindexSource(`map-route:${route.id}`, route.updatedAt))) continue;
      await this.replaceSource({
        id: `map-route:${route.id}`,
        kind: 'map_route',
        sourceRef: route.id,
        title: `Route: ${route.title}`,
        chunks: chunkText(
          [
            `Saved route: ${route.title}.`,
            route.distanceMeters ? `Distance: ${(route.distanceMeters / 1000).toFixed(1)} km.` : '',
            `Points: ${route.points
              .map((point) =>
                [point.title, `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`]
                  .filter(Boolean)
                  .join(' at ')
              )
              .join('; ')}.`,
          ]
            .filter(Boolean)
            .join('\n')
        ),
      });
    }

    for (const region of regions) {
      if (!(await this.shouldReindexSource(`map-region:${region.id}`, region.updatedAt))) continue;
      await this.replaceSource({
        id: `map-region:${region.id}`,
        kind: 'map_region',
        sourceRef: region.id,
        title: `Offline map: ${region.name}`,
        chunks: chunkText(
          [
            `Offline map region: ${region.name}.`,
            `Status: ${region.status}.`,
            region.north !== null &&
            region.south !== null &&
            region.east !== null &&
            region.west !== null
              ? `Bounds: north ${region.north}, south ${region.south}, east ${region.east}, west ${region.west}.`
              : '',
            region.minZoom !== null || region.maxZoom !== null
              ? `Zoom: ${region.minZoom ?? 'default'} to ${region.maxZoom ?? 'default'}.`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        ),
      });
    }
  }

  static async cacheZimArticle(pack: ContentPack, path: string, article: ZimArticle) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const cacheId = `zim-cache:${pack.id}:${article.finalPath || path}`;
    const paragraphs = extractArticleParagraphs(article.html);
    if (!paragraphs.length) return null;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO zim_articles_cache
          (id, zim_id, path, title, html_hash, extracted_at, last_accessed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(zim_id, path) DO UPDATE SET
           title = excluded.title,
           html_hash = excluded.html_hash,
           last_accessed_at = excluded.last_accessed_at`,
        [
          cacheId,
          pack.id,
          article.finalPath || path,
          article.title || path,
          hashText(article.html),
          timestamp,
          timestamp,
        ]
      );
      await db.runAsync('DELETE FROM zim_paragraph_chunks WHERE article_cache_id = ?', [cacheId]);
      for (let index = 0; index < paragraphs.length; index += 1) {
        await db.runAsync(
          `INSERT INTO zim_paragraph_chunks
            (id, article_cache_id, zim_id, path, title, section_title, paragraph_index, text, token_estimate, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            cacheId,
            pack.id,
            article.finalPath || path,
            article.title || path,
            paragraphs[index].sectionTitle,
            index,
            paragraphs[index].text,
            estimateTokens(paragraphs[index].text),
            timestamp,
          ]
        );
      }
    });

    await this.replaceSource({
      id: `zim:${pack.id}:${article.finalPath || path}`,
      kind: 'zim_article',
      sourceRef: pack.id,
      title: `${pack.title}: ${article.title || path}`,
      chunks: paragraphs.map((paragraph) =>
        [paragraph.sectionTitle ? `Section: ${paragraph.sectionTitle}.` : '', paragraph.text]
          .filter(Boolean)
          .join('\n')
      ),
    });

    return paragraphs[0]?.text ?? null;
  }

  static async removeSource(sourceId: string) {
    await this.queueSourceWrite(async () => {
      const db = await DatabaseClient.getDb();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
          [sourceId]
        );
        await db.runAsync(
          'DELETE FROM chunk_embeddings WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
          [sourceId]
        );
        await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [sourceId]);
        await db.runAsync('DELETE FROM rag_sources WHERE id = ?', [sourceId]);
      });
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
      `INSERT OR REPLACE INTO chunk_embeddings
        (chunk_id, model_id, dimension, embedding_blob, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [chunkId, RAG_HASH_EMBEDDING_MODEL_ID, embedding.byteLength / 4, embedding, timestamp]
    );
    await db.runAsync(
      'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
      [chunkId, text, 'Ark starter guide']
    );
    await RagVectorService.upsertChunk(db, { chunkId, embedding });
  }

  static async search(query: string, options: { limit?: number } = {}): Promise<AiCitation[]> {
    await this.seedCoreContent();
    await this.indexNotes();
    await this.indexInstalledContentPacks();
    await this.indexImportedDocuments();
    await this.indexRssItems();
    await this.indexMapData();
    await this.removeSourceIfExists('weather:latest');
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
      embedding_model_id: string | null;
    }> = [];
    const limit = options.limit ?? 4;
    for (const fts of ftsQueries) {
      rows = await db.getAllAsync<(typeof rows)[number]>(
        `SELECT f.chunk_id,
                f.text,
                f.source_title,
                c.source_id,
                c.chunk_index,
                c.embedding_model_id,
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
    const ftsCitations = (await rankRows(query, rows)).slice(0, limit).map((row) => ({
      ...citationForRow(row),
      snippet: snippetForRow(row),
    }));
    const zimCitations =
      ftsCitations.length < limit
        ? await searchInstalledZimArticles(query, limit - ftsCitations.length)
        : [];
    return dedupeCitations([...ftsCitations, ...zimCitations]).slice(0, limit);
  }

  static async expandCitations(
    citations: AiCitation[],
    options: { maxSources?: number; maxCharsPerSource?: number } = {}
  ) {
    const maxSources = options.maxSources ?? 3;
    const maxCharsPerSource = options.maxCharsPerSource ?? 1600;
    const selected = citations.slice(0, maxSources);
    return Promise.all(
      selected.map(async (citation) => ({
        sourceId: citation.sourceId,
        title: citation.title,
        content: await this.readSourceContext(citation, maxCharsPerSource),
      }))
    );
  }

  static async readSourceContext(citation: AiCitation, maxChars = 1600) {
    const db = await DatabaseClient.getDb();
    let rows = await db.getAllAsync<{ text: string }>(
      'SELECT text FROM rag_chunks WHERE source_id = ? ORDER BY chunk_index ASC LIMIT 4',
      [citation.sourceId]
    );

    if (!rows.length && citation.sourceId.startsWith('zim:')) {
      const [, packId, ...pathParts] = citation.sourceId.split(':');
      const path = pathParts.join(':');
      const pack = (await ContentRepository.list()).find((item) => item.id === packId);
      if (pack && path) {
        await getZimArticleText(pack, path);
      }
      rows = await db.getAllAsync<{ text: string }>(
        'SELECT text FROM rag_chunks WHERE source_id = ? ORDER BY chunk_index ASC LIMIT 4',
        [citation.sourceId]
      );
    }

    const content = rows
      .map((row) => row.text.trim())
      .filter(Boolean)
      .join('\n\n')
      .slice(0, maxChars);

    return content || citation.snippet;
  }

  private static async shouldReindexSource(sourceId: string, updatedAt: number) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{ updated_at: number | null }>(
      'SELECT updated_at FROM rag_sources WHERE id = ?',
      [sourceId]
    );
    return !row?.updated_at || row.updated_at < updatedAt;
  }

  private static async removeMissingSources(kinds: string[], activeSourceIds: Set<string>) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM rag_sources WHERE kind IN (${kinds.map(() => '?').join(', ')})`,
      kinds
    );
    for (const row of rows) {
      if (!activeSourceIds.has(row.id)) await this.removeSource(row.id);
    }
  }

  private static async removeSourceIfExists(sourceId: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM rag_sources WHERE id = ?', [
      sourceId,
    ]);
    if (row) await this.removeSource(sourceId);
  }

  private static async buildPackChunks(pack: ContentPack) {
    const metadataChunks = this.buildContentChunks(pack);
    if (!pack.installed || !pack.localUri) return metadataChunks;
    if (pack.format === 'zim') return metadataChunks;

    const bodyChunks = await readInstalledPackBody(pack);
    if (!bodyChunks.length) return metadataChunks;
    return bodyChunks;
  }
}

async function searchInstalledZimArticles(query: string, limit: number): Promise<AiCitation[]> {
  if (limit <= 0) return [];
  const packs = (await ContentRepository.list()).filter(
    (pack) => pack.installed && pack.localUri && pack.format === 'zim'
  );
  const citations: AiCitation[] = [];

  for (const pack of packs) {
    if (citations.length >= limit) break;
    try {
      const remaining = limit - citations.length;
      const results = await ZimService.search(pack, query, remaining);
      for (const result of results) {
        if (citations.length >= limit) break;
        citations.push(await citationForZimResult(pack, result));
      }
    } catch {
      // Native ZIM search is optional. Keep RAG useful in Expo Go and other non-native builds.
    }
  }

  return citations;
}

async function citationForZimResult(
  pack: ContentPack,
  result: ZimSearchResult
): Promise<AiCitation> {
  const title = result.title.trim() || result.path;
  const articleText = await getZimArticleText(pack, result.path);
  return {
    sourceId: `zim:${pack.id}:${result.path}`,
    title: `${pack.title}: ${title}`,
    snippet: (articleText || result.snippet?.trim() || title).slice(0, 240),
    sourceRef: pack.id,
    sectionTitle: title,
    targetHref: `/content/${encodeURIComponent(pack.id)}?article=${encodeURIComponent(
      result.path
    )}`,
  };
}

async function getZimArticleText(pack: ContentPack, path: string) {
  try {
    const article = await ZimService.getArticle(pack, path);
    return await RagService.cacheZimArticle(pack, path, article);
  } catch {
    return null;
  }
}

function extractArticleParagraphs(html: string) {
  const blockMarked = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|section|article)>/gi, '\n')
    .replace(/<(h1|h2|h3|h4)[^>]*>/gi, '\n# ');
  const lines = stripHtml(blockMarked)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const paragraphs: Array<{ sectionTitle: string | null; text: string }> = [];
  let sectionTitle: string | null = null;
  for (const line of lines) {
    if (line.startsWith('# ')) {
      sectionTitle = line.slice(2).trim().slice(0, 120) || sectionTitle;
      continue;
    }
    if (line.length < 60) continue;
    paragraphs.push({ sectionTitle, text: line.slice(0, 1800) });
    if (paragraphs.length >= 24) break;
  }
  return paragraphs;
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

async function readInstalledPackBody(pack: ContentPack) {
  const header = [
    `${pack.title}.`,
    pack.description,
    pack.sourceLabel ? `Source: ${pack.sourceLabel}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (pack.format === 'html' || pack.format === 'markdown' || pack.format === 'txt') {
    const fileText = await FileSystem.readAsStringAsync(pack.localUri!, {
      encoding: FileSystem.EncodingType.UTF8,
    }).catch(() => '');
    const normalized =
      pack.format === 'html' ? stripHtml(fileText) : fileText.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];
    return chunkText(`${header}\n${normalized.slice(0, 40000)}`);
  }

  if (pack.format === 'pdf') {
    const extracted = await OcrService.extractPdfText(pack.localUri!, 120);
    if (extracted.status === 'ready' && extracted.pages.some((page) => page.text.trim())) {
      return extracted.pages.flatMap((page) =>
        chunkText([header, `Page ${page.pageNumber}.`, page.text.trim()].filter(Boolean).join('\n'))
      );
    }
  }

  return [];
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash.toString(16);
}

function dedupeCitations(citations: AiCitation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    if (seen.has(citation.sourceId)) return false;
    seen.add(citation.sourceId);
    return true;
  });
}

async function rankRows<T extends { embedding_blob: unknown; embedding_model_id?: string | null }>(
  query: string,
  rows: T[]
) {
  const queryEmbedding = await EmbeddingService.embedQuery(query);
  const hashQueryEmbedding =
    queryEmbedding.modelId === RAG_HASH_EMBEDDING_MODEL_ID
      ? queryEmbedding.vector
      : embedText(query);
  return rows
    .map((row, index) => {
      const modelId = row.embedding_model_id ?? RAG_HASH_EMBEDDING_MODEL_ID;
      const embedding =
        modelId === queryEmbedding.modelId
          ? deserializeEmbeddingWithDimensions(row.embedding_blob, queryEmbedding.dimensions)
          : deserializeEmbedding(row.embedding_blob);
      const comparison =
        modelId === queryEmbedding.modelId ? queryEmbedding.vector : hashQueryEmbedding;
      return {
        row,
        index,
        score: embedding ? cosineSimilarity(comparison, embedding) : Number.NEGATIVE_INFINITY,
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
  text: string;
}) {
  const section =
    row.kind === 'guide' || row.kind === 'zim'
      ? GuideService.getSections(row.source_ref)[row.chunk_index]
      : null;
  const page = parsePageNumber(row.text) ?? section?.page;
  const contentTarget =
    row.source_id.startsWith('content:') && row.source_ref && row.kind === 'guide'
      ? `/content/reader?packId=${encodeURIComponent(row.source_ref)}${
          section?.title ? `&section=${encodeURIComponent(section.title)}` : ''
        }${page ? `&page=${page}` : ''}`
      : row.source_id.startsWith('content:') && row.source_ref
        ? `/content/${encodeURIComponent(row.source_ref)}`
        : undefined;
  const documentPage = row.source_id.startsWith('document:') ? page : null;
  const documentTarget =
    row.source_id.startsWith('document:') && row.source_ref
      ? `/documents/${encodeURIComponent(row.source_ref)}${
          documentPage ? `?page=${documentPage}` : ''
        }`
      : undefined;
  const zimArticlePath = row.source_id.startsWith('zim:')
    ? row.source_id.split(':').slice(2).join(':')
    : null;
  const zimArticleTarget =
    zimArticlePath && row.source_ref
      ? `/content/${encodeURIComponent(row.source_ref)}?article=${encodeURIComponent(zimArticlePath)}`
      : undefined;
  const rssTarget = row.source_id.startsWith('rss:')
    ? `/tools/news/${encodeURIComponent(row.source_ref)}`
    : undefined;
  const mapTarget =
    row.source_id.startsWith('map-marker:') ||
    row.source_id.startsWith('map-route:') ||
    row.source_id.startsWith('map-region:')
      ? '/(tabs)/map'
      : undefined;

  return {
    sourceId: row.source_id,
    title: row.source_title,
    sourceRef: row.source_ref,
    sectionTitle: section?.title,
    page,
    targetHref:
      contentTarget ??
      documentTarget ??
      zimArticleTarget ??
      rssTarget ??
      mapTarget,
  };
}

function parsePageNumber(text: string) {
  const match = text.match(/\b(?:Page|Reader page target):\s*(\d{1,5})\b/i);
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isFinite(page) && page > 0 ? page : null;
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
  return (
    row.text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.slice(0, 240) ?? row.text.slice(0, 240)
  );
}
