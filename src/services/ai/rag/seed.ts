import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { estimateTokens } from '@/services/ai/chunking';
import {
  RAG_HASH_EMBEDDING_MODEL_ID,
  embedText,
  serializeEmbedding,
} from '@/services/ai/rag-embedding';
import { RagVectorService } from '@/services/ai/rag-vector.service';

export async function seedCoreContent() {
  const db = await DatabaseClient.getDb();
  const sourceId = 'guide:starter';

  await db.withTransactionAsync(async (tx) => {
    const insertSource = await tx.runAsync(
      `INSERT OR IGNORE INTO rag_sources (id, kind, source_ref, title, created_at, updated_at)
       VALUES (?, 'guide', 'starter', 'Ark starter guide', ?, ?)`,
      [sourceId, Date.now(), Date.now()]
    );
    if (insertSource.changes === 0) return;

    const chunkId = randomUUID();
    const timestamp = Date.now();
    const text =
      'Ark starter guide: keep downloaded maps, first aid references, emergency contacts, weather cache, and private notes available before going offline.';
    const embedding = serializeEmbedding(embedText(text));

    await tx.runAsync(
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
    await tx.runAsync(
      `INSERT OR REPLACE INTO chunk_embeddings
        (chunk_id, model_id, dimension, embedding_blob, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [chunkId, RAG_HASH_EMBEDDING_MODEL_ID, embedding.byteLength / 4, embedding, timestamp]
    );
    await tx.runAsync(
      'INSERT INTO rag_chunks_fts (chunk_id, text, source_title) VALUES (?, ?, ?)',
      [chunkId, text, 'Ark starter guide']
    );
    await RagVectorService.upsertChunk(tx, { chunkId, embedding });
  });
}
