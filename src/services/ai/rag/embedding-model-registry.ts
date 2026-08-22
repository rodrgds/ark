import { getEmbeddingModelConfigById } from '@/services/ai/embedding-models';
import type { EmbeddingModelConfig } from '@/services/ai/embedding-models';
import type { SQLiteDatabase } from 'expo-sqlite';

type EmbeddingModelDb = {
  runAsync: SQLiteDatabase['runAsync'];
};

export async function ensureEmbeddingModelRecord(
  db: EmbeddingModelDb,
  modelId: string,
  timestamp = Date.now()
) {
  const model = getEmbeddingModelConfigById(modelId);
  if (!model) throw new Error(`Unknown embedding model: ${modelId}`);
  await db.runAsync(
    `INSERT INTO embedding_models
      (id, display_name, family, dimension, distance, quantization, query_prefix,
       document_prefix, normalize, installed_at, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       display_name = excluded.display_name,
       family = excluded.family,
       dimension = excluded.dimension,
       distance = excluded.distance,
       query_prefix = excluded.query_prefix,
       document_prefix = excluded.document_prefix,
       normalize = excluded.normalize,
       updated_at = excluded.updated_at`,
    [
      model.id,
      model.title,
      model.family,
      model.dimension,
      model.distance,
      model.queryPrefix,
      model.documentPrefix,
      model.normalize ? 1 : 0,
      timestamp,
      timestamp,
    ]
  );
}
