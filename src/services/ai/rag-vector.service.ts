import { RAG_HASH_EMBEDDING_DIMENSIONS } from '@/services/ai/rag-embedding';
import {
  EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS,
  EXECUTORCH_TEXT_EMBEDDING_MODEL_ID,
} from '@/services/ai/embedding-models';

const HASH_VECTOR_TABLE = 'rag_chunk_vectors_v2';
const VECTOR_TABLES: Record<string, { table: string; dimensions: number }> = {
  'ark-hash-v2': { table: HASH_VECTOR_TABLE, dimensions: RAG_HASH_EMBEDDING_DIMENSIONS },
  [EXECUTORCH_TEXT_EMBEDDING_MODEL_ID]: {
    table: 'rag_chunk_vectors_executorch_multi_qa_minilm_384',
    dimensions: EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS,
  },
};

type VectorDb = {
  execAsync: (sql: string) => Promise<void>;
  // Expo SQLite and Bun's test shim expose different overloads for bound params.
  runAsync: (sql: string, ...args: any[]) => Promise<unknown>;
};

const vectorAvailable = new Map<string, boolean>();

export class RagVectorService {
  static async isAvailable(db: VectorDb, modelId = 'ark-hash-v2') {
    const table = VECTOR_TABLES[modelId] ?? VECTOR_TABLES['ark-hash-v2'];
    const cached = vectorAvailable.get(table.table);
    if (cached !== undefined) return cached;
    try {
      await db.execAsync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ${table.table} USING vec0(
          embedding float[${table.dimensions}] distance_metric=cosine,
          +chunk_id text
        )
      `);
      vectorAvailable.set(table.table, true);
    } catch {
      vectorAvailable.set(table.table, false);
    }
    return vectorAvailable.get(table.table) ?? false;
  }

  static async removeChunks(db: VectorDb, chunkIds: string[]) {
    if (!chunkIds.length) return;
    for (const modelId of Object.keys(VECTOR_TABLES)) {
      if (!(await this.isAvailable(db, modelId))) continue;
      const table = VECTOR_TABLES[modelId];
      for (const chunkId of chunkIds) {
        await db.runAsync(`DELETE FROM ${table.table} WHERE chunk_id = ?`, [chunkId]);
      }
    }
  }

  static async upsertChunk(
    db: VectorDb,
    input: { chunkId: string; embedding: Uint8Array; modelId?: string }
  ) {
    const table = VECTOR_TABLES[input.modelId ?? 'ark-hash-v2'];
    if (!table || !(await this.isAvailable(db, input.modelId))) return;
    await db.runAsync(`DELETE FROM ${table.table} WHERE chunk_id = ?`, [input.chunkId]);
    await db.runAsync(`INSERT INTO ${table.table} (embedding, chunk_id) VALUES (?, ?)`, [
      input.embedding,
      input.chunkId,
    ]);
  }

  static resetForTests() {
    vectorAvailable.clear();
  }
}
