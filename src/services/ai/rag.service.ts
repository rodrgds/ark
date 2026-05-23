import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { DocumentsRepository } from '@/services/db/repositories/documents.repo';
import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { RssRepository } from '@/services/db/repositories/rss.repo';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
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
import { ZimService, type ZimSearchResult } from '@/services/content/zim.service';
import type { AiCitation } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';
import type { MapMarker, MapRegion, SavedRoute } from '@/types/maps';

type RagSourceInput = {
  id: string;
  kind: string;
  sourceRef: string;
  title: string;
  chunks: string[];
};

const LIVE_LOCAL_SOURCE_KINDS = ['map_marker', 'map_region', 'map_route', 'rss_item', 'weather'];

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
    .map((part) => part.replace(/[^a-zA-Z0-9_]/g, '').trim())
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
  private static async replaceSources(
    inputs: RagSourceInput[],
    options: { pruneKinds?: string[] } = {}
  ) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    await db.withTransactionAsync(async () => {
      const sourceIdsToClear = new Set(inputs.map((input) => input.id));
      for (const kind of options.pruneKinds ?? []) {
        const rows = await db.getAllAsync<{ id: string }>(
          'SELECT id FROM rag_sources WHERE kind = ?',
          [kind]
        );
        rows.forEach((row) => sourceIdsToClear.add(row.id));
      }

      const oldChunkIds: string[] = [];
      for (const sourceId of sourceIdsToClear) {
        const oldChunks = await db.getAllAsync<{ id: string }>(
          'SELECT id FROM rag_chunks WHERE source_id = ?',
          [sourceId]
        );
        oldChunks.forEach((chunk) => oldChunkIds.push(chunk.id));
        await db.runAsync(
          'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
          [sourceId]
        );
        await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [sourceId]);
        await db.runAsync('DELETE FROM rag_sources WHERE id = ?', [sourceId]);
      }
      await RagVectorService.removeChunks(db, oldChunkIds);

      for (const input of inputs) {
        const chunks = input.chunks.map((chunk) => chunk.trim()).filter(Boolean);
        if (!chunks.length) continue;
        await db.runAsync(
          `INSERT INTO rag_sources (id, kind, source_ref, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [input.id, input.kind, input.sourceRef, input.title, timestamp, timestamp]
        );
        for (let index = 0; index < chunks.length; index += 1) {
          const text = chunks[index];
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
      }
    });
  }

  private static async replaceSource(input: RagSourceInput) {
    await this.replaceSources([input]);
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

  static buildDocumentChunks(document: ArkDocument) {
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
    await this.replaceSource({
      id: `document:${document.id}`,
      kind: 'document',
      sourceRef: document.id,
      title: document.title,
      chunks: this.buildDocumentChunks(document),
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

  static async indexLiveLocalContext() {
    const [markers, regions, routes, rssItems, weather] = await Promise.all([
      MapsRepository.listMarkers(),
      MapsRepository.listRegions(),
      MapsRepository.listRoutes(),
      RssRepository.listRecentItems(20),
      WeatherCacheService.getLatest(),
    ]);

    const sources: RagSourceInput[] = [
      ...markers.map((marker) => sourceForMarker(marker)),
      ...regions.map((region) => sourceForRegion(region)),
      ...routes.map((route) => sourceForRoute(route)),
      ...rssItems.map((item) => ({
        id: `rss:${item.id}`,
        kind: 'rss_item',
        sourceRef: item.id,
        title: `Cached alert: ${item.title}`,
        chunks: [
          [
            `Cached RSS item: ${item.title}.`,
            `Feed: ${item.feed_title}.`,
            item.author ? `Author: ${item.author}.` : '',
            item.summary,
            item.content,
          ]
            .filter(Boolean)
            .join('\n'),
        ],
      })),
    ];

    if (weather) {
      sources.push({
        id: 'weather:latest',
        kind: 'weather',
        sourceRef: weather.id,
        title: `Cached weather: ${weather.location}`,
        chunks: [weatherSourceText(weather)],
      });
    }

    await this.replaceSources(sources, { pruneKinds: LIVE_LOCAL_SOURCE_KINDS });
  }

  static async removeSource(sourceId: string) {
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async () => {
      const oldChunks = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM rag_chunks WHERE source_id = ?',
        [sourceId]
      );
      await db.runAsync(
        'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
        [sourceId]
      );
      await RagVectorService.removeChunks(
        db,
        oldChunks.map((chunk) => chunk.id)
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
    await this.indexImportedDocuments();
    await this.indexLiveLocalContext();
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
    const ftsCitations = rankRows(query, rows)
      .slice(0, limit)
      .map((row) => ({
        ...citationForRow(row),
        snippet: snippetForRow(row),
      }));
    const zimCitations =
      ftsCitations.length < limit
        ? await searchInstalledZimArticles(query, limit - ftsCitations.length)
        : [];
    return dedupeCitations([...ftsCitations, ...zimCitations]).slice(0, limit);
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

function sourceForMarker(marker: MapMarker): RagSourceInput {
  return {
    id: `map-marker:${marker.id}`,
    kind: 'map_marker',
    sourceRef: marker.id,
    title: `Map spot: ${marker.title}`,
    chunks: [
      [
        `Saved map spot: ${marker.title}.`,
        marker.description ? `Description: ${marker.description}.` : '',
        `Coordinates: ${formatPoint(marker.latitude, marker.longitude)}.`,
        marker.icon ? `Icon: ${marker.icon}.` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ],
  };
}

function sourceForRegion(region: MapRegion): RagSourceInput {
  const center =
    region.north != null && region.south != null && region.east != null && region.west != null
      ? formatPoint((region.north + region.south) / 2, (region.east + region.west) / 2)
      : null;
  return {
    id: `map-region:${region.id}`,
    kind: 'map_region',
    sourceRef: region.id,
    title: `Map region: ${region.name}`,
    chunks: [
      [
        `Offline map region: ${region.name}.`,
        `Status: ${region.status.replace('_', ' ')}.`,
        `Provider: ${region.provider}.`,
        center ? `Center: ${center}.` : '',
        region.north != null && region.south != null && region.east != null && region.west != null
          ? `Bounds: north ${region.north}, south ${region.south}, east ${region.east}, west ${region.west}.`
          : '',
        `Zoom range: ${region.minZoom ?? 'unknown'} to ${region.maxZoom ?? 'unknown'}.`,
        region.sizeBytes
          ? `Downloaded size: ${Math.round(region.sizeBytes / 1024 / 1024)} MB.`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ],
  };
}

function sourceForRoute(route: SavedRoute): RagSourceInput {
  const points = route.points
    .map((point, index) => {
      const label = point.title ? `${point.title} ` : `Point ${index + 1} `;
      return `${label}at ${formatPoint(point.latitude, point.longitude)}`;
    })
    .join('; ');
  return {
    id: `map-route:${route.id}`,
    kind: 'map_route',
    sourceRef: route.id,
    title: `Map route: ${route.title}`,
    chunks: [
      [
        `Saved map route: ${route.title}.`,
        `${route.points.length} point${route.points.length === 1 ? '' : 's'}.`,
        route.distanceMeters ? `Distance: ${formatDistance(route.distanceMeters)}.` : '',
        points ? `Route points: ${points}.` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ],
  };
}

function weatherSourceText(
  weather: NonNullable<Awaited<ReturnType<typeof WeatherCacheService.getLatest>>>
) {
  const daily = weather.forecast.daily
    .map((day) => {
      const parts = [
        day.highC != null ? `high ${Math.round(day.highC)}C` : null,
        day.lowC != null ? `low ${Math.round(day.lowC)}C` : null,
        day.precipitationMm != null ? `${day.precipitationMm} mm precipitation` : null,
      ].filter(Boolean);
      return `${day.date}: ${parts.join(', ') || 'forecast cached'}`;
    })
    .join('\n');
  return [
    `Cached weather for ${weather.location}.`,
    `Provider: ${weather.provider}.`,
    `Freshness: ${weather.freshness}${weather.stale ? ' (stale)' : ''}.`,
    `Current summary: ${weather.forecast.summary}.`,
    weather.forecast.temperatureC != null
      ? `Temperature: ${Math.round(weather.forecast.temperatureC)}C.`
      : '',
    weather.forecast.windKph != null ? `Wind: ${Math.round(weather.forecast.windKph)} km/h.` : '',
    weather.forecast.pressureHpa != null
      ? `Pressure: ${Math.round(weather.forecast.pressureHpa)} hPa.`
      : '',
    daily ? `Daily forecast:\n${daily}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatPoint(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(1)} km`;
  return `${Math.round(distanceMeters)} m`;
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
    return stripHtml(article.html)
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 40);
  } catch {
    return null;
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeCitations(citations: AiCitation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    if (seen.has(citation.sourceId)) return false;
    seen.add(citation.sourceId);
    return true;
  });
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
      ? row.kind === 'guide'
        ? `/content/reader?packId=${encodeURIComponent(row.source_ref)}${
            section?.title ? `&section=${encodeURIComponent(section.title)}` : ''
          }`
        : `/content/${encodeURIComponent(row.source_ref)}`
      : undefined;
  const documentTarget =
    row.source_id.startsWith('document:') && row.source_ref
      ? `/documents/${encodeURIComponent(row.source_ref)}`
      : undefined;
  const mapTarget =
    row.kind === 'map_marker' || row.kind === 'map_region' || row.kind === 'map_route'
      ? '/(tabs)/map'
      : undefined;
  const rssTarget = row.kind === 'rss_item' ? '/(tabs)/library' : undefined;
  const weatherTarget = row.kind === 'weather' ? '/tools/weather' : undefined;

  return {
    sourceId: row.source_id,
    title: row.source_title,
    sourceRef: row.source_ref,
    sectionTitle: section?.title,
    page: section?.page,
    targetHref: contentTarget ?? documentTarget ?? mapTarget ?? rssTarget ?? weatherTarget,
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
  return (
    row.text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.slice(0, 240) ?? row.text.slice(0, 240)
  );
}
