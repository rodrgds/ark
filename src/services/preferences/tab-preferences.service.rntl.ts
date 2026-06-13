import { beforeEach, describe, expect, mock, test } from 'bun:test';

const settings = new Map<string, string>();
const settingsSet = mock(async (key: string, value: string) => {
  settings.set(key, value);
});

mock.module('@/services/db/repositories/settings.repo', () => ({
  SettingsRepository: {
    get: async (key: string) => settings.get(key) ?? null,
    set: settingsSet,
  },
}));

describe('TabPreferencesService', () => {
  beforeEach(() => {
    settings.clear();
    settingsSet.mockClear();
  });

  test('normalizes corrupted stored order and enabled tab ids', async () => {
    settings.set('tabs.order', JSON.stringify(['tools', 'map', 'ghost', 'chat', 'map']));
    settings.set('tabs.enabled', JSON.stringify(['map', 'library', 'ghost', 'map']));

    const { TabPreferencesService } =
      await import('@/services/preferences/tab-preferences.service');

    await expect(TabPreferencesService.getPreferences()).resolves.toEqual({
      order: ['tools', 'map', 'chat', 'library', 'notes', 'settings'],
      enabled: ['map', 'library', 'chat', 'settings'],
    });
  });

  test('persists normalized order and refuses to disable locked tabs', async () => {
    const { TabPreferencesService } =
      await import('@/services/preferences/tab-preferences.service');
    const listener = mock(() => undefined);
    const unsubscribe = TabPreferencesService.subscribe(listener);

    await expect(
      TabPreferencesService.setOrder(['notes', 'map', 'notes'] as never)
    ).resolves.toEqual(['notes', 'map', 'chat', 'library', 'tools', 'settings']);
    expect(JSON.parse(settings.get('tabs.order') ?? '[]')).toEqual([
      'notes',
      'map',
      'chat',
      'library',
      'tools',
      'settings',
    ]);

    await expect(TabPreferencesService.setEnabled('chat', false)).resolves.toContain('chat');
    expect(JSON.parse(settings.get('tabs.enabled') ?? '[]')).toContain('settings');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await TabPreferencesService.setEnabled('map', false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
