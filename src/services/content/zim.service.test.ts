import { beforeEach, describe, expect, test } from 'bun:test';
import { ZimService } from '@/services/content/zim.service';
import type { ContentPack } from '@/types/content';

const basePack: ContentPack = {
  id: 'wikipedia-en-top100-nopic',
  title: 'Wikipedia Top 100',
  description: 'Tiny smoke-test archive.',
  category: 'Wiki',
  format: 'zim',
  estimatedSize: '13 MB',
  sourceUrl: 'https://download.kiwix.org/zim/wikipedia/wikipedia_en_100_nopic_2026-04.zim',
  installed: false,
  installStatus: 'not_installed',
  progress: 0,
  createdAt: 1,
  updatedAt: 1,
};

describe('ZimService', () => {
  beforeEach(() => {
    ZimService.setNativeModuleForTests(undefined);
  });

  test('plans a download-first path before a ZIM archive is installed', () => {
    const plan = ZimService.getReaderPlan(basePack);

    expect(plan.installed).toBe(false);
    expect(plan.handoffAvailable).toBe(false);
    expect(plan.embeddedReaderAvailable).toBe(false);
    expect(plan.nextStep).toContain('Download');
  });

  test('plans an in-app reader attempt with OS handoff fallback for installed archives', () => {
    const plan = ZimService.getReaderPlan({
      ...basePack,
      installed: true,
      installStatus: 'installed',
      progress: 1,
      localUri: 'file:///ark/content/wiki.zim',
    });

    expect(plan.installed).toBe(true);
    expect(plan.handoffAvailable).toBe(true);
    expect(plan.embeddedReaderAvailable).toBe(false);
    expect(plan.inAppReaderCandidate).toBe(true);
    expect(plan.limitations.join(' ')).toContain('ArkZim');
  });

  test('uses the native reader module for offline search and articles', async () => {
    const calls: string[] = [];
    ZimService.setNativeModuleForTests({
      openArchive: async (path) => {
        calls.push(path);
        return {
          id: 'wiki',
          title: 'Wikipedia',
          language: 'en',
          articleCount: 100,
          mainPath: 'A/Main_Page',
        };
      },
      search: async (query) => [{ path: 'A/Water', title: query, snippet: 'Water storage' }],
      suggest: async () => [],
      getArticle: async (path) => ({
        path,
        html: '<p>Boil water.</p>',
        mimeType: 'text/html',
        finalPath: path,
        title: 'Water',
      }),
    });

    const installedPack = {
      ...basePack,
      installed: true,
      installStatus: 'installed',
      progress: 1,
      localUri: 'file:///ark/content/wiki.zim',
    } satisfies ContentPack;

    expect((await ZimService.openArchive(installedPack)).mainPath).toBe('A/Main_Page');
    expect((await ZimService.search(installedPack, 'water'))[0]?.title).toBe('water');
    expect((await ZimService.getArticle(installedPack, 'A/Water')).html).toContain('Boil');
    expect(calls).toEqual([
      'file:///ark/content/wiki.zim',
      'file:///ark/content/wiki.zim',
      'file:///ark/content/wiki.zim',
    ]);
  });
});
