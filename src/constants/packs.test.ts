import { describe, expect, test } from 'bun:test';
import { STARTER_PACKS } from '@/constants/packs';

describe('starter content packs', () => {
  test('uses real downloadable URLs for every curated pack', () => {
    expect(STARTER_PACKS.length).toBeGreaterThan(0);
    for (const pack of STARTER_PACKS) {
      expect(pack.id).not.toContain('placeholder');
      expect(pack.sourceUrl).toMatch(/^https:\/\//);
      expect(pack.title.length).toBeGreaterThan(4);
      expect(pack.description.length).toBeGreaterThan(20);
    }
  });

  test('includes multiple English Wikipedia options', () => {
    const wiki = STARTER_PACKS.filter(
      (pack) => pack.category === 'Wiki' && pack.title.toLowerCase().includes('wikipedia')
    );

    expect(wiki.length).toBeGreaterThanOrEqual(3);
    expect(wiki.some((pack) => pack.id.includes('mini'))).toBe(true);
    expect(wiki.some((pack) => pack.id.includes('nopic'))).toBe(true);
  });

  test('model packs point to GGUF files', () => {
    const models = STARTER_PACKS.filter((pack) => pack.category === 'AI Models');

    expect(models.length).toBeGreaterThanOrEqual(2);
    for (const model of models) {
      expect(model.format).toBe('gguf');
      expect(model.sourceUrl?.toLowerCase().split('?')[0]).toEndWith('.gguf');
      expect(model.sizeBytes ?? 0).toBeGreaterThan(500 * 1024 * 1024);
    }
  });
});
