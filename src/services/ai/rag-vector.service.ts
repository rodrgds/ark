import { RAG_HASH_EMBEDDING_DIMENSIONS } from '@/services/ai/rag-embedding';

const VECTOR_TABLE = 'rag_chunk_vectors_v2';

type VectorDb = {
  execAsync: (sql: string) => Promise<void>;
  // Expo SQLite and Bun's test shim expose different overloads for bound params.
  runAsync: (sql: string, ...args: any[]) => Promise<unknown>;
};

let vectorAvailable: boolean | null = null;

export class RagVectorService {
  static async isAvailable(db: VectorDb) {
    if (vectorAvailable !== null) return vectorAvailable;
    try {
      await db.execAsync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTOR_TABLE} USING vec0(
          embedding float[${RAG_HASH_EMBEDDING_DIMENSIONS}] distance_metric=cosine,
          +chunk_id text
        )
      `);
      vectorAvailable = true;
    } catch {
      vectorAvailable = false;
    }
    return vectorAvailable;
  }

  static async removeChunks(db: VectorDb, chunkIds: string[]) {
    if (!chunkIds.length || !(await this.isAvailable(db))) return;
    for (const chunkId of chunkIds) {
      await db.runAsync(`DELETE FROM ${VECTOR_TABLE} WHERE chunk_id = ?`, [chunkId]);
    }
  }

  static async upsertChunk(db: VectorDb, input: { chunkId: string; embedding: Uint8Array }) {
    if (!(await this.isAvailable(db))) return;
    await db.runAsync(`DELETE FROM ${VECTOR_TABLE} WHERE chunk_id = ?`, [input.chunkId]);
    await db.runAsync(`INSERT INTO ${VECTOR_TABLE} (embedding, chunk_id) VALUES (?, ?)`, [
      input.embedding,
      input.chunkId,
    ]);
  }

  static resetForTests() {
    vectorAvailable = null;
  }
}
