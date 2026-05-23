import { describe, expect, test } from 'bun:test';
import {
  RAG_HASH_EMBEDDING_DIMENSIONS,
  cosineSimilarity,
  deserializeEmbedding,
  embedText,
  serializeEmbedding,
} from '@/services/ai/rag-embedding';

describe('RAG hash embeddings', () => {
  test('are deterministic, normalized, and round-trip through SQLite-friendly blobs', () => {
    const first = embedText('Control bleeding and treat shock with direct pressure.');
    const second = embedText('Control bleeding and treat shock with direct pressure.');
    expect(first).toEqual(second);
    expect(first).toHaveLength(RAG_HASH_EMBEDDING_DIMENSIONS);

    const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 5);

    const blob = serializeEmbedding(first);
    expect(blob.byteLength).toBe(RAG_HASH_EMBEDDING_DIMENSIONS * 4);
    const roundTrip = deserializeEmbedding(blob);
    expect(roundTrip).toHaveLength(RAG_HASH_EMBEDDING_DIMENSIONS);
    for (let index = 0; index < first.length; index += 1) {
      expect(roundTrip?.[index]).toBeCloseTo(first[index], 6);
    }
  });

  test('scores related text above unrelated text', () => {
    const query = embedText('bleeding shock pressure');
    const related = embedText('Apply direct pressure for bleeding and watch for shock.');
    const unrelated = embedText('Navigate by stars and keep a route bearing.');

    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });
});
