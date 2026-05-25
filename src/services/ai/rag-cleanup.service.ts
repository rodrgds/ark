import { DatabaseClient } from '@/services/db/client';
import { RagVectorService } from '@/services/ai/rag-vector.service';

export class RagCleanupService {
  static async removeSource(sourceId: string) {
    const db = await DatabaseClient.getDb();
    const chunkIds = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM rag_chunks WHERE source_id = ?',
      [sourceId]
    );
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'DELETE FROM rag_chunks_fts WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
        [sourceId]
      );
      await RagVectorService.removeChunks(
        db,
        chunkIds.map((chunk) => chunk.id)
      );
      await db.runAsync(
        'DELETE FROM chunk_embeddings WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE source_id = ?)',
        [sourceId]
      );
      await db.runAsync('DELETE FROM rag_chunks WHERE source_id = ?', [sourceId]);
      await db.runAsync('DELETE FROM rag_sources WHERE id = ?', [sourceId]);
    });
  }

  static async removeSourcesByRef(sourceRef: string) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM rag_sources WHERE source_ref = ?',
      [sourceRef]
    );
    for (const row of rows) {
      await this.removeSource(row.id);
    }
  }

  static async removeZimCache(zimId: string) {
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM zim_paragraph_chunks WHERE zim_id = ?', [zimId]);
      await db.runAsync('DELETE FROM zim_articles_cache WHERE zim_id = ?', [zimId]);
    });
    await this.removeSourcesByRef(zimId);
  }
}
