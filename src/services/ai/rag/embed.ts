import { DatabaseClient } from '@/services/db/client';
import { EmbeddingService } from '@/services/ai/embedding.service';
import { serializeEmbedding } from '@/services/ai/rag-embedding';
import { RagVectorService } from '@/services/ai/rag-vector.service';

export type RagEmbeddingRebuildProgress = {
  modelId: string;
  total: number;
  embedded: number;
  phase: 'embedding' | 'promoting' | 'complete';
};

type RebuildOptions = {
  batchSize?: number;
  onProgress?: (progress: RagEmbeddingRebuildProgress) => void | Promise<void>;
};

const DEFAULT_REBUILD_BATCH_SIZE = 16;

export async function rebuildEmbeddingsForActiveModel(options: RebuildOptions = {}) {
  const db = await DatabaseClient.getDb();
  const chunks = await db.getAllAsync<{ id: string; text: string }>(
    'SELECT id, text FROM rag_chunks ORDER BY created_at ASC'
  );
  if (chunks.length === 0) return;
  const targetModel = await EmbeddingService.getActiveModelConfig();
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_REBUILD_BATCH_SIZE);
  let embedded = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);
    const embeddingResults: Array<{
      id: string;
      result: Awaited<ReturnType<typeof EmbeddingService.embedDocument>>;
    }> = [];
    for (const chunk of chunkBatch) {
      const result = await EmbeddingService.embedDocument(chunk.text);
      if (result.modelId !== targetModel.id) {
        throw new Error('Source-search model failed while rebuilding the local index.');
      }
      embeddingResults.push({ id: chunk.id, result });
    }
    await db.withTransactionAsync(async (tx) => {
      for (const { id, result } of embeddingResults) {
        const embedding = serializeEmbedding(result.vector);
        await tx.runAsync(
          `INSERT OR REPLACE INTO chunk_embeddings
            (chunk_id, model_id, dimension, embedding_blob, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, result.modelId, result.dimensions, embedding, Date.now()]
        );
        await RagVectorService.upsertChunk(tx, {
          chunkId: id,
          embedding,
          modelId: result.modelId,
        });
      }
    });
    embedded += embeddingResults.length;
    await options.onProgress?.({
      modelId: targetModel.id,
      total: chunks.length,
      embedded,
      phase: 'embedding',
    });
  }

  await options.onProgress?.({
    modelId: targetModel.id,
    total: chunks.length,
    embedded,
    phase: 'promoting',
  });

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    await db.withTransactionAsync(async (tx) => {
      for (const chunk of batch) {
        await tx.runAsync(
          `UPDATE rag_chunks
           SET embedding_model_id = ?,
               embedding_blob = (
                 SELECT embedding_blob
                 FROM chunk_embeddings
                 WHERE chunk_id = ? AND model_id = ?
               )
           WHERE id = ?
             AND EXISTS (
               SELECT 1 FROM chunk_embeddings WHERE chunk_id = ? AND model_id = ?
             )`,
          [targetModel.id, chunk.id, targetModel.id, chunk.id, chunk.id, targetModel.id]
        );
      }
    });
  }

  await options.onProgress?.({
    modelId: targetModel.id,
    total: chunks.length,
    embedded,
    phase: 'complete',
  });
}
