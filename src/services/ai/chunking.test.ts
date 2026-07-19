import { describe, expect, test } from 'bun:test';
import { splitTextForRag } from '@/services/ai/chunking';

describe('RAG chunking', () => {
  test('splits indexed source text at natural boundaries with overlap', async () => {
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
    expect(chunks.every((chunk) => chunk.length <= 90)).toBe(true);
    expect(chunks.join(' ')).toContain('Water storage checklist');
  });

  test('never lets a multi-character boundary exceed the requested chunk size', async () => {
    const chunks = await splitTextForRag(`${'a'.repeat(88)}. ${'b'.repeat(40)}`, {
      chunkSize: 90,
      chunkOverlap: 10,
    });

    expect(chunks.every((chunk) => chunk.length <= 90)).toBe(true);
  });
});
