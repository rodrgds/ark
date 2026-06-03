import { describe, expect, test } from 'bun:test';
import { splitTextForRag } from '@/services/ai/chunking';

describe('RAG chunking', () => {
  test('uses the recursive splitter path for indexed source text', async () => {
    const chunks = await splitTextForRag(
      [
        'Water storage checklist.',
        'Keep sealed containers in a cool dark place and rotate stored water.',
        'Filter cloudy water before disinfection and record treatment dates.',
        'Separate drinking water from utility water so emergency supplies stay clean.',
      ].join('\n\n'),
      { chunkSize: 90, chunkOverlap: 12 }
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.trim().length > 0)).toBe(true);
    expect(chunks.join(' ')).toContain('Water storage checklist');
  });
});
