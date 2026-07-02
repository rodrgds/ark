import { DatabaseClient } from '@/services/db/client';
import { toFtsPrefixQueries } from '@/services/db/fts';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { EmbeddingService, type EmbeddingResult } from '@/services/ai/embedding.service';
import {
  RAG_HASH_EMBEDDING_MODEL_ID,
  cosineSimilarity,
  deserializeEmbedding,
  deserializeEmbeddingWithDimensions,
  embedText,
  serializeEmbedding,
} from '@/services/ai/rag-embedding';
import { RagVectorService } from '@/services/ai/rag-vector.service';
import { GuideService } from '@/services/content/guide.service';
import { ZimService, type ZimArticle, type ZimSearchResult } from '@/services/content/zim.service';
import type { AiCitation, AiProgressEvent } from '@/types/ai';
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

type SearchRow = {
  chunk_id: string;
  text: string;
  source_title: string;
  source_id: string;
  source_ref: string;
  kind: string;
  chunk_index: number;
  embedding_blob: unknown;
  embedding_model_id: string | null;
};

export type RagRefreshMode = 'all' | 'chat' | 'none';

export type RagSearchDeps = {
  prepareSearchIndexes: (
    refreshMode: RagRefreshMode,
    onProgress?: (progress: AiProgressEvent) => void
  ) => Promise<void>;
  removeSourceIfExists: (sourceId: string) => Promise<void>;
  cacheZimArticle: (pack: ContentPack, path: string, article: ZimArticle) => Promise<string | null>;
};

function toFtsQueries(query: string) {
  return toFtsPrefixQueries(query, { stopwords: STOPWORDS, meaningfulMinLength: 3 });
}

export async function searchRag(
  query: string,
  options: {
    limit?: number;
    onProgress?: (progress: AiProgressEvent) => void;
    refreshIndexes?: RagRefreshMode;
  },
  deps: RagSearchDeps
): Promise<AiCitation[]> {
  await deps.prepareSearchIndexes(options.refreshIndexes ?? 'all', options.onProgress);
  await deps.removeSourceIfExists('weather:latest');

  const ftsQueries = toFtsQueries(query);
  const db = await DatabaseClient.getDb();
  let ftsRows: SearchRow[] = [];
  const limit = options.limit ?? 4;

  for (const fts of ftsQueries) {
    ftsRows = await db.getAllAsync<SearchRow>(
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
    if (ftsRows.length) break;
  }

  options.onProgress?.({ stage: 'ranking_sources', label: 'Ranking sources' });
  const queryEmbedding = await EmbeddingService.embedQuery(query);
  const vectorMatches = await RagVectorService.searchChunks(db, {
    embedding: serializeEmbedding(queryEmbedding.vector),
    modelId: queryEmbedding.modelId,
    limit: Math.max(limit * 4, 12),
  });
  const semanticChunkIds = vectorMatches
    .filter((match) => match.distance <= 0.65)
    .map((match) => match.chunk_id);
  const semanticRows = semanticChunkIds.length
    ? await db.getAllAsync<SearchRow>(
        `SELECT c.id AS chunk_id,
                c.text,
                s.title AS source_title,
                c.source_id,
                c.chunk_index,
                c.embedding_model_id,
                c.embedding_blob,
                s.source_ref,
                s.kind
         FROM rag_chunks c
         JOIN rag_sources s ON s.id = c.source_id
         WHERE c.id IN (${semanticChunkIds.map(() => '?').join(', ')})`,
        semanticChunkIds
      )
    : [];

  const rows = dedupeRows([...ftsRows, ...semanticRows]);
  const ftsCitations = (await rankRows(query, rows, queryEmbedding)).slice(0, limit).map((row) => ({
    ...citationForRow(row),
    snippet: snippetForRow(row),
  }));

  options.onProgress?.({ stage: 'searching_zim', label: 'Searching ZIM archives' });
  const zimCitations =
    ftsCitations.length < limit
      ? await searchInstalledZimArticles(query, limit - ftsCitations.length, deps)
      : [];
  return dedupeCitations([...ftsCitations, ...zimCitations]).slice(0, limit);
}

export async function expandRagCitations(
  citations: AiCitation[],
  options: { maxSources?: number; maxCharsPerSource?: number },
  deps: RagSearchDeps
) {
  const maxSources = options.maxSources ?? 3;
  const maxCharsPerSource = options.maxCharsPerSource ?? 1600;
  const selected = citations.slice(0, maxSources);
  return Promise.all(
    selected.map(async (citation) => ({
      sourceId: citation.sourceId,
      title: citation.title,
      content: await readRagSourceContext(citation, maxCharsPerSource, deps),
    }))
  );
}

export async function readRagSourceContext(
  citation: AiCitation,
  maxChars: number,
  deps: RagSearchDeps
) {
  const db = await DatabaseClient.getDb();
  let rows = await readFocusedSourceRows(db, citation);

  if (!rows.length && citation.sourceId.startsWith('zim:')) {
    const [, packId, ...pathParts] = citation.sourceId.split(':');
    const path = pathParts.join(':');
    const pack = (await ContentRepository.list()).find((item) => item.id === packId);
    if (pack && path) {
      await getZimArticleText(pack, path, deps);
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

async function searchInstalledZimArticles(
  query: string,
  limit: number,
  deps: RagSearchDeps
): Promise<AiCitation[]> {
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
        citations.push(await citationForZimResult(pack, result, deps));
      }
    } catch {
      // Native ZIM search is optional. Keep RAG useful in Expo Go and other non-native builds.
    }
  }

  return citations;
}

async function citationForZimResult(
  pack: ContentPack,
  result: ZimSearchResult,
  deps: RagSearchDeps
): Promise<AiCitation> {
  const title = result.title.trim() || result.path;
  const articleText = await getZimArticleText(pack, result.path, deps);
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

async function getZimArticleText(pack: ContentPack, path: string, deps: RagSearchDeps) {
  try {
    const article = await ZimService.getArticle(pack, path);
    return await deps.cacheZimArticle(pack, path, article);
  } catch {
    return null;
  }
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
  rows: T[],
  providedQueryEmbedding?: EmbeddingResult
) {
  const queryEmbedding = providedQueryEmbedding ?? (await EmbeddingService.embedQuery(query));
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

function dedupeRows<T extends { chunk_id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.chunk_id)) return false;
    seen.add(row.chunk_id);
    return true;
  });
}

function citationForRow(row: {
  source_id: string;
  source_title: string;
  source_ref: string;
  kind: string;
  chunk_index: number;
  text: string;
}) {
  const parsedPage = parsePageNumber(row.text);
  const indexedSection =
    row.kind === 'guide' || row.kind === 'zim'
      ? GuideService.getSections(row.source_ref)[row.chunk_index]
      : null;
  const page = parsedPage ?? indexedSection?.page;
  const section =
    row.kind === 'guide' || row.kind === 'zim'
      ? page
        ? GuideService.getSectionForPage(row.source_ref, page)
        : indexedSection
      : null;
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
  const noteTarget =
    row.source_id.startsWith('note:') && row.source_ref
      ? `/notes/editor?id=${encodeURIComponent(row.source_ref)}`
      : undefined;

  return {
    sourceId: row.source_id,
    title: row.source_title,
    sourceRef: row.source_ref,
    sectionTitle: section?.title,
    page,
    chunkIndex: row.chunk_index,
    targetHref:
      contentTarget ?? documentTarget ?? zimArticleTarget ?? rssTarget ?? mapTarget ?? noteTarget,
  };
}

async function readFocusedSourceRows(
  db: Awaited<ReturnType<typeof DatabaseClient.getDb>>,
  citation: AiCitation
) {
  if (typeof citation.chunkIndex === 'number') {
    const start = Math.max(0, citation.chunkIndex - 1);
    const end = citation.chunkIndex + 2;
    const focusedRows = await db.getAllAsync<{ text: string }>(
      `SELECT text FROM rag_chunks
       WHERE source_id = ? AND chunk_index BETWEEN ? AND ?
       ORDER BY chunk_index ASC
       LIMIT 4`,
      [citation.sourceId, start, end]
    );
    if (focusedRows.length) return focusedRows;
  }
  return db.getAllAsync<{ text: string }>(
    'SELECT text FROM rag_chunks WHERE source_id = ? ORDER BY chunk_index ASC LIMIT 4',
    [citation.sourceId]
  );
}

function parsePageNumber(text: string) {
  const match = text.match(/\b(?:Page|Reader page target):\s*(\d{1,5})\b/i);
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isFinite(page) && page > 0 ? page : null;
}

function isMetadataLine(line: string) {
  const prefixes = [
    'document:',
    'type:',
    'page:',
    'reader page target:',
    'saved map spot:',
    'saved route:',
    'offline map region:',
    'status:',
    'bounds:',
    'zoom:',
    'feed:',
    'headline:',
    'published:',
    'source url:',
    'category:',
    'format:',
    'size:',
    'source:',
    'section:',
    'coordinates:',
    'points:',
  ];
  const lower = line.toLowerCase();
  return prefixes.some((prefix) => lower.startsWith(prefix));
}

function snippetForRow(row: {
  source_ref: string;
  kind: string;
  chunk_index: number;
  text: string;
}) {
  const page = parsePageNumber(row.text);
  const indexedSection =
    row.kind === 'guide' || row.kind === 'zim'
      ? GuideService.getSections(row.source_ref)[row.chunk_index]
      : null;
  const section =
    row.kind === 'guide' || row.kind === 'zim'
      ? page
        ? GuideService.getSectionForPage(row.source_ref, page)
        : indexedSection
      : null;
  if (section?.detail) return section.detail;

  const lines = row.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (row.kind === 'note') {
    if (lines.length >= 2) {
      return lines[1].slice(0, 240);
    }
  }

  const contentLine = lines.find((line) => !isMetadataLine(line)) ?? lines[0] ?? '';
  return contentLine.slice(0, 240);
}
