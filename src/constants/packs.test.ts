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

  test('Kiwix ZIM packs expose official SHA-256 checksum sidecars', () => {
    const zimPacks = STARTER_PACKS.filter((pack) => pack.format === 'zim');

    expect(zimPacks.length).toBeGreaterThan(0);
    for (const pack of zimPacks) {
      expect(pack.checksumSha256Url).toBe(`${pack.sourceUrl}.sha256`);
    }
  });

  test('curated model packs are answer GGUF files', () => {
    const models = STARTER_PACKS.filter((pack) => pack.category === 'AI Models');
    const chatModels = models.filter((model) => model.id.startsWith('model-'));
    const embeddingModels = models.filter((model) => model.id.startsWith('embedding-'));

    expect(chatModels.length).toBeGreaterThanOrEqual(2);
    expect(embeddingModels.length).toBe(0);
    for (const model of models) {
      expect(model.format).toBe('gguf');
      expect(model.sourceUrl?.toLowerCase().split('?')[0]).toEndWith('.gguf');
    }
    for (const model of chatModels) {
      expect(model.sizeBytes ?? 0).toBeGreaterThan(500 * 1024 * 1024);
      expect(model.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(chatModels.every((model) => model.modelRole === 'chat')).toBe(true);
  });

  test('includes plant safety guidance without mushroom identification claims', () => {
    const plantSafety = STARTER_PACKS.find(
      (pack) => pack.id === 'usda-special-forest-products-harvest'
    );

    expect(plantSafety?.sourceUrl).toBe('https://research.fs.usda.gov/download/treesearch/45826.pdf');
    expect(plantSafety?.sourceLabel).toBe('USDA Forest Service');
    expect(`${plantSafety?.title} ${plantSafety?.description}`.toLowerCase()).not.toContain(
      'mushroom identification'
    );
  });

  test('official web guides use offline snapshot downloads and are organized by category', () => {
    const htmlGuides = STARTER_PACKS.filter((pack) => pack.format === 'html');
    const ids = htmlGuides.map((p) => p.id);

    expect(htmlGuides.length).toBeGreaterThan(0);
    expect(htmlGuides.every((pack) => pack.downloadStrategy === 'html_snapshot')).toBe(true);
    expect(ids).toContain('food-preservation-usda');
    expect(ids).toContain('sanitation-hygiene');
    
    expect(STARTER_PACKS.find((p) => p.id === 'food-preservation-usda')?.category).toBe('Food');
    expect(STARTER_PACKS.find((p) => p.id === 'sanitation-hygiene')?.category).toBe('Water');
  });
});
