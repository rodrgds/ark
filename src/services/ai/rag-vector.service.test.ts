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
});
