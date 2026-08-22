import type { SQLiteDatabase } from 'expo-sqlite';
import { RAG_HASH_EMBEDDING_DIMENSIONS } from '@/services/ai/rag-embedding';
import {
  EXECUTORCH_MPNET_EMBEDDING_DIMENSIONS,
  EXECUTORCH_MPNET_EMBEDDING_MODEL_ID,
  EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS,
  EXECUTORCH_TEXT_EMBEDDING_MODEL_ID,
} from '@/services/ai/embedding-models';

const HASH_VECTOR_TABLE = 'rag_chunk_vectors_v2';
const SQLITE_DELETE_BATCH_SIZE = 400;
type VectorTableInfo = { table: string; dimensions: number };
const VECTOR_TABLES = {
  'ark-hash-v2': { table: HASH_VECTOR_TABLE, dimensions: RAG_HASH_EMBEDDING_DIMENSIONS },
  [EXECUTORCH_TEXT_EMBEDDING_MODEL_ID]: {
    table: 'rag_chunk_vectors_executorch_multi_qa_minilm_384',
    dimensions: EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS,
  },
  [EXECUTORCH_MPNET_EMBEDDING_MODEL_ID]: {
    table: 'rag_chunk_vectors_executorch_multi_qa_mpnet_768',
    dimensions: EXECUTORCH_MPNET_EMBEDDING_DIMENSIONS,
  },
} satisfies Record<string, { table: string; dimensions: number }>;

type VectorDb = {
  execAsync: (sql: string) => Promise<void>;
  // The service only issues statements and ignores results, so any driver
  // whose runAsync matches expo-sqlite's shape fits.
  runAsync: SQLiteDatabase['runAsync'];
};

const vectorAvailable = new Map<string, boolean>();

function vectorTableFor(modelId: string): VectorTableInfo {
  // SAFETY: VECTOR_TABLES keys are exactly the supported model ids; unknown
  // ids fall back to the hash table below.
  const entries = Object.entries(VECTOR_TABLES) as Array<[string, VectorTableInfo]>;
  return new Map(entries).get(modelId) ?? VECTOR_TABLES['ark-hash-v2'];
}

export class RagVectorService {
  static async isAvailable(db: VectorDb, modelId = 'ark-hash-v2') {
    const table = vectorTableFor(modelId);
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
      const table = vectorTableFor(modelId);
      for (let offset = 0; offset < chunkIds.length; offset += SQLITE_DELETE_BATCH_SIZE) {
        const batch = chunkIds.slice(offset, offset + SQLITE_DELETE_BATCH_SIZE);
        const placeholders = batch.map(() => '?').join(', ');
        await db.runAsync(`DELETE FROM ${table.table} WHERE chunk_id IN (${placeholders})`, batch);
      }
    }
  }

  static async upsertChunk(
    db: VectorDb,
    input: { chunkId: string; embedding: Uint8Array; modelId?: string }
  ) {
    const table = vectorTableFor(input.modelId ?? 'ark-hash-v2');
    if (!table || !(await this.isAvailable(db, input.modelId))) return;
    await db.runAsync(`DELETE FROM ${table.table} WHERE chunk_id = ?`, [input.chunkId]);
    await db.runAsync(`INSERT INTO ${table.table} (embedding, chunk_id) VALUES (?, ?)`, [
      input.embedding,
      input.chunkId,
    ]);
  }

  static async searchChunks(
    db: VectorDb & {
      getAllAsync: <T>(sql: string, params: any[]) => Promise<T[]>;
    },
    input: { embedding: Uint8Array; modelId: string; limit: number }
  ) {
    const table = vectorTableFor(input.modelId);
    if (!table || !(await this.isAvailable(db, input.modelId))) return [];
    try {
      return await db.getAllAsync<{ chunk_id: string; distance: number }>(
        `SELECT chunk_id, distance
         FROM ${table.table}
         WHERE embedding MATCH ? AND k = ?
         ORDER BY distance`,
        [input.embedding, input.limit]
      );
    } catch {
      return [];
    }
  }

  static resetForTests() {
    vectorAvailable.clear();
  }
}
