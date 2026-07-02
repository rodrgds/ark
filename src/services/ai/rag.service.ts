import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { DatabaseClient } from '@/services/db/client';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { DocumentsRepository } from '@/services/db/repositories/documents.repo';
import { DocumentPagesRepository } from '@/services/db/repositories/document-pages.repo';
import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { RssRepository } from '@/services/db/repositories/rss.repo';
import { chunkText, estimateTokens, splitTextForRag } from '@/services/ai/chunking';
import { serializeEmbedding } from '@/services/ai/rag-embedding';
import { RagVectorService } from '@/services/ai/rag-vector.service';
import { RagCleanupService } from '@/services/ai/rag-cleanup.service';
import { EmbeddingService, type EmbeddingResult } from '@/services/ai/embedding.service';
import {
  rebuildEmbeddingsForActiveModel as rebuildRagEmbeddingsForActiveModel,
  type RagEmbeddingRebuildProgress,
} from '@/services/ai/rag/embed';
import {
  expandRagCitations,
  readRagSourceContext,
  searchRag,
  type RagRefreshMode,
  type RagSearchDeps,
} from '@/services/ai/rag/search';
import { seedCoreContent as seedRagCoreContent } from '@/services/ai/rag/seed';
import { GuideService } from '@/services/content/guide.service';
import { type ZimArticle } from '@/services/content/zim.service';
import { OcrService } from '@/services/ocr/ocr.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { getNoteRagText } from '@/lib/note-text';
import type { AiCitation } from '@/types/ai';
import type { AiProgressEvent } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';
import type { DocumentPage } from '@/types/db';

export class RagService {
  private static sourceWriteQueue: Promise<unknown> = Promise.resolve();

  private static async queueSourceWrite<T>(operation: () => Promise<T>) {
    const next = this.sourceWriteQueue.then(operation, operation);
    this.sourceWriteQueue = next.catch(() => undefined);
    return next;
  }

  private static searchDeps(): RagSearchDeps {
    return {
      prepareSearchIndexes: (refreshMode, onProgress) =>
        this.prepareSearchIndexes(refreshMode, onProgress),
      removeSourceIfExists: (sourceId) => this.removeSourceIfExists(sourceId),
      cacheZimArticle: (pack, path, article) => this.cacheZimArticle(pack, path, article),
    };
  }

  private static async replaceSource(input: {
    id: string;
    kind: string;
    sourceRef: string;
    title: string;
    chunks: string[];
    updatedAt?: number;
  }) {
    const timestamp = input.updatedAt ?? Date.now();
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
      await db.withTransactionAsync(async (tx) => {
        await tx.runAsync(
          `INSERT INTO rag_sources (id, kind, source_ref, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind,
           source_ref = excluded.source_ref,
           title = excluded.title,
           updated_at = excluded.updated_at`,
          [input.id, input.kind, input.sourceRef, input.title, timestamp, timestamp]
        );
        await tx.runAsync(
          'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
          [input.id]
        );
        await RagVectorService.removeChunks(
          tx,
          oldChunks.map((chunk) => chunk.id)
        );
        await tx.runAsync(
          'DELETE FROM chunk_embeddings WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
          [input.id]
        );
        await tx.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [input.id]);
        for (let index = 0; index < embeddedChunks.length; index += 1) {
          const { text, embeddingResult, embedding } = embeddedChunks[index];
          const id = randomUUID();
          await tx.runAsync(
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
          await tx.runAsync(
            `INSERT OR REPLACE INTO chunk_embeddings
              (chunk_id, model_id, dimension, embedding_blob, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [id, embeddingResult.modelId, embeddingResult.dimensions, embedding, timestamp]
          );
          await tx.runAsync(
            'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
            [id, text, input.title]
          );
          await RagVectorService.upsertChunk(tx, {
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
    const chunks = await splitTextForRag(getNoteRagText(note));
    if (await this.sourceChunksMatch(sourceId, chunks)) {
      await this.markSourceFresh(sourceId, note.title, note.updatedAt);
      return;
    }
    await this.replaceSource({
      id: sourceId,
      kind: 'note',
      sourceRef: note.id,
      title: note.title,
      chunks,
      updatedAt: note.updatedAt,
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
    if (await PreferencesService.getBatteryReduceModeEnabled()) return;
    const packs = await ContentRepository.list();
    for (const pack of packs.filter((item) => item.installed && item.category !== 'AI Models')) {
      await this.indexContentPack(pack.id);
    }
  }

  static async buildDocumentChunks(document: ArkDocument, pages: DocumentPage[] = []) {
    if (pages.length) {
      const chunks: string[] = [];
      for (const page of pages) {
        chunks.push(
          ...(await splitTextForRag(
            [
              `Document: ${document.title}.`,
              document.mimeType ? `Type: ${document.mimeType}.` : '',
              `Page: ${page.pageNumber}. Extraction: ${page.extractionMethod}.`,
              page.text,
            ]
              .filter(Boolean)
              .join('\n')
          ))
        );
      }
      return chunks;
    }
    const text = [
      `Document: ${document.title}.`,
      document.mimeType ? `Type: ${document.mimeType}.` : '',
      document.extractedText,
      document.ocrText ? `Text found in attached image:\n${document.ocrText}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return splitTextForRag(text);
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
      chunks: await this.buildDocumentChunks(document, pages),
    });
    await DocumentsRepository.markIndexed(document.id);
  }

  static async indexImportedDocuments() {
    if (await PreferencesService.getBatteryReduceModeEnabled()) return;
    const documents = await DocumentsRepository.list();
    for (const document of documents) {
      if (document.indexedAt && document.indexedAt >= document.updatedAt) continue;
      await this.indexDocument(document.id);
    }
  }

  static async indexRssItems() {
    if (await PreferencesService.getBatteryReduceModeEnabled()) return;
    const items = await RssRepository.listRecentItems(50);
    for (const item of items) {
      if (!(await this.shouldReindexSource(`rss:${item.id}`, item.created_at))) continue;
      await this.replaceSource({
        id: `rss:${item.id}`,
        kind: 'rss',
        sourceRef: item.id,
        title: `${item.feed_title}: ${item.title}`,
        chunks: await splitTextForRag(
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
    if (await PreferencesService.getBatteryReduceModeEnabled()) return;
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
        chunks: await splitTextForRag(
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
        chunks: await splitTextForRag(
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
        chunks: await splitTextForRag(
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

    await db.withTransactionAsync(async (tx) => {
      await tx.runAsync(
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
      await tx.runAsync('DELETE FROM zim_paragraph_chunks WHERE article_cache_id = ?', [cacheId]);
      for (let index = 0; index < paragraphs.length; index += 1) {
        await tx.runAsync(
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
      await RagCleanupService.removeSource(sourceId);
    });
  }

  static async removeSourcesByRef(sourceRef: string) {
    await this.queueSourceWrite(async () => {
      await RagCleanupService.removeSourcesByRef(sourceRef);
    });
  }

  static async removeZimPackSources(packId: string) {
    await this.queueSourceWrite(async () => {
      await RagCleanupService.removeZimCache(packId);
    });
  }

  static async markAllSourcesForReindex() {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE rag_sources SET updated_at = 0');
  }

  static async rebuildEmbeddingsForActiveModel(
    options: {
      batchSize?: number;
      onProgress?: (progress: RagEmbeddingRebuildProgress) => void | Promise<void>;
    } = {}
  ) {
    await rebuildRagEmbeddingsForActiveModel(options);
  }

  static async seedCoreContent() {
    await seedRagCoreContent();
  }

  static async search(
    query: string,
    options: {
      limit?: number;
      onProgress?: (progress: AiProgressEvent) => void;
      refreshIndexes?: RagRefreshMode;
    } = {}
  ): Promise<AiCitation[]> {
    return searchRag(query, options, this.searchDeps());
  }

  static async expandCitations(
    citations: AiCitation[],
    options: { maxSources?: number; maxCharsPerSource?: number } = {}
  ) {
    return expandRagCitations(citations, options, this.searchDeps());
  }

  static async readSourceContext(citation: AiCitation, maxChars = 1600) {
    return readRagSourceContext(citation, maxChars, this.searchDeps());
  }

  private static async shouldReindexSource(sourceId: string, updatedAt: number) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{ updated_at: number | null }>(
      'SELECT updated_at FROM rag_sources WHERE id = ?',
      [sourceId]
    );
    return !row?.updated_at || row.updated_at < updatedAt;
  }

  private static async sourceChunksMatch(sourceId: string, chunks: string[]) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<{ text: string }>(
      'SELECT text FROM rag_chunks WHERE source_id = ? ORDER BY chunk_index ASC',
      [sourceId]
    );
    return rows.length === chunks.length && rows.every((row, index) => row.text === chunks[index]);
  }

  private static async markSourceFresh(sourceId: string, title: string, updatedAt: number) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE rag_sources SET title = ?, updated_at = ? WHERE id = ?', [
      title,
      updatedAt,
      sourceId,
    ]);
  }

  private static async prepareSearchIndexes(
    refreshMode: RagRefreshMode,
    onProgress?: (progress: AiProgressEvent) => void
  ) {
    await this.seedCoreContent();
    if (refreshMode === 'none') return;

    onProgress?.({ stage: 'searching_notes', label: 'Searching local notes' });
    await this.indexNotes();

    if (refreshMode === 'chat') {
      onProgress?.({ stage: 'searching_guides', label: 'Searching saved guide index' });
      return;
    }

    onProgress?.({ stage: 'searching_guides', label: 'Searching guides' });
    await this.indexInstalledContentPacks();
    onProgress?.({ stage: 'searching_documents', label: 'Searching documents' });
    await this.indexImportedDocuments();
    onProgress?.({ stage: 'searching_rss', label: 'Searching emergency feeds' });
    await this.indexRssItems();
    onProgress?.({ stage: 'searching_maps', label: 'Searching saved maps' });
    await this.indexMapData();
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
    return splitTextForRag(`${header}\n${normalized.slice(0, 40000)}`);
  }

  if (pack.format === 'pdf') {
    const extracted = await OcrService.extractPdfText(pack.localUri!, 120);
    if (extracted.status === 'ready' && extracted.pages.some((page) => page.text.trim())) {
      const chunks: string[] = [];
      for (const page of extracted.pages) {
        chunks.push(
          ...(await splitTextForRag(
            [header, `Page ${page.pageNumber}.`, page.text.trim()].filter(Boolean).join('\n')
          ))
        );
      }
      return chunks;
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
