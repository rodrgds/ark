import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';

installCommonRntlMocks(mock);

const { act, render, userEvent, waitFor } = await import('@testing-library/react-native');

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
    const user = userEvent.setup();

    const view = await render(<TabPreferencesCard />);

    const mapToggle = await view.findByLabelText('Turn Map tab off');
    expect(mapToggle).toBeEnabled();
    expect(view.getByLabelText('Turn Arky tab off')).toBeDisabled();
    expect(view.getByLabelText('Turn Settings tab off')).toBeDisabled();
    expect(view.getByLabelText('Turn Notes tab on')).toBeEnabled();

    await user.press(mapToggle);

    const applyButton = await view.findByText('Apply Changes');
    await user.press(applyButton);

    await waitFor(() => {
      expect(settingsSet).toHaveBeenCalledWith('tabs.enabled', expect.any(String));
    });
    await waitFor(() => {
      expect(view.queryByText('Apply Changes')).toBeNull();
    });

    const persisted = JSON.parse(settings.get('tabs.enabled') ?? '[]') as string[];
    expect(persisted).not.toContain('map');
    expect(persisted).toContain('chat');
    expect(persisted).toContain('settings');
    expect(await view.findByLabelText('Turn Map tab on')).toBeEnabled();
  });

  test('reorders while dragging and persists only after apply', async () => {
    const { TabPreferencesCard } = await import('@/components/settings/tab-preferences-card');
    const user = userEvent.setup();

    const view = await render(<TabPreferencesCard />);
    const mapHandle = await view.findByLabelText('Drag Map to reorder');
    const gesture = mapHandle.props.testOnlyGesture as {
      testOnlyHandlers?: {
        onBegin?: () => void;
        onUpdate?: (event: { translationY: number }) => void;
        onFinalize?: (event: { translationY: number }) => void;
      };
    };

    await act(async () => {
      gesture.testOnlyHandlers?.onBegin?.();
      gesture.testOnlyHandlers?.onUpdate?.({ translationY: 70 });
    });

    expect(settingsSet).not.toHaveBeenCalled();
    const applyButton = await view.findByText('Apply Changes');

    await act(async () => {
      gesture.testOnlyHandlers?.onFinalize?.({ translationY: 70 });
    });

    await user.press(applyButton);

    await waitFor(() => {
      expect(settingsSet).toHaveBeenCalledWith('tabs.order', expect.any(String));
    });
    const persistedOrder = JSON.parse(settings.get('tabs.order') ?? '[]') as string[];
    expect(persistedOrder.slice(0, 4)).toEqual(['chat', 'tracks', 'library', 'map']);
  });
});
