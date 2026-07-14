import { describe, expect, test } from 'bun:test';
import { RagVectorService } from '@/services/ai/rag-vector.service';

describe('RAG vector search', () => {
  test('queries sqlite-vec with the selected ExecuTorch embedding table', async () => {
    RagVectorService.resetForTests();
    let query = '';
    let params: unknown[] = [];
    const db = {
      execAsync: async () => {},
      runAsync: async () => {},
      getAllAsync: async <T>(sql: string, nextParams: unknown[]) => {
        query = sql;
        params = nextParams;
        return [{ chunk_id: 'chunk-1', distance: 0.2 }] as T[];
      },
    };

    const embedding = new Uint8Array(768 * 4);
    const rows = await RagVectorService.searchChunks(db, {
      embedding,
      modelId: 'executorch-multi-qa-mpnet-base-dot-v1',
      limit: 8,
    });

    expect(query).toContain('rag_chunk_vectors_executorch_multi_qa_mpnet_768');
    expect(query).toContain('embedding MATCH ? AND k = ?');
    expect(params).toEqual([embedding, 8]);
    expect(rows).toEqual([{ chunk_id: 'chunk-1', distance: 0.2 }]);
  });

  test('removes chunk vectors in bounded parameterized batches', async () => {
    RagVectorService.resetForTests();
    const deletes: Array<{ sql: string; params: string[] }> = [];
    const db = {
      execAsync: async () => {},
      runAsync: async (sql: string, params: string[]) => {
        deletes.push({ sql, params });
      },
    };
    const chunkIds = Array.from({ length: 401 }, (_, index) => `chunk-${index}`);

    await RagVectorService.removeChunks(db, chunkIds);

    expect(deletes).toHaveLength(6);
    expect(deletes.every(({ sql }) => sql.includes('chunk_id IN ('))).toBe(true);
    expect(deletes.map(({ params }) => params.length)).toEqual([400, 1, 400, 1, 400, 1]);
    expect(deletes[0]?.params[0]).toBe('chunk-0');
    expect(deletes[1]?.params[0]).toBe('chunk-400');
  });
});
