import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';

installCommonRntlMocks(mock);

const { fireEvent, render, waitFor } = await import('@testing-library/react-native');

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

describe('TabPreferencesCard', () => {
  beforeEach(() => {
    settings.clear();
    settingsSet.mockClear();
  });

  test('persists disabling an optional tab and keeps locked tabs enabled', async () => {
    const { TabPreferencesCard } = await import('@/components/settings/tab-preferences-card');

    const view = await render(<TabPreferencesCard />);

    const mapToggle = await view.findByLabelText('Turn Map tab off');
    expect(mapToggle).toBeEnabled();
    expect(view.getByLabelText('Turn Arky tab off')).toBeDisabled();
    expect(view.getByLabelText('Turn Settings tab off')).toBeDisabled();

    await fireEvent.press(mapToggle);

    await waitFor(() => {
      expect(settingsSet).toHaveBeenCalledWith('tabs.enabled', expect.any(String));
    });

    const persisted = JSON.parse(settings.get('tabs.enabled') ?? '[]') as string[];
    expect(persisted).not.toContain('map');
    expect(persisted).toContain('chat');
    expect(persisted).toContain('settings');
    expect(await view.findByLabelText('Turn Map tab on')).toBeEnabled();
  });
});
