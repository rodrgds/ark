import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';

installCommonRntlMocks(mock);

const { fireEvent, render } = await import('@testing-library/react-native');

const routerPush = mock((href: unknown) => href);
const settings = new Map<string, string>();

mock.module('expo-router', () => ({
  router: { push: routerPush },
  useFocusEffect: (effect: () => void | (() => void)) => {
    React.useEffect(effect, [effect]);
  },
}));

mock.module('@/services/db/repositories/settings.repo', () => ({
  SettingsRepository: {
    get: async (key: string) => settings.get(key) ?? null,
    set: async (key: string, value: string) => {
      settings.set(key, value);
    },
  },
}));

describe('FunctionSearchButton', () => {
  beforeEach(() => {
    routerPush.mockClear();
    settings.clear();
  });

  test('hides disabled tab destinations and their child tool shortcuts', async () => {
    settings.set('tabs.enabled', JSON.stringify(['chat', 'library', 'notes', 'settings']));
    const { FunctionSearchButton } = await import('@/components/layout/function-search');

    const view = await render(<FunctionSearchButton />);
    await fireEvent.press(view.getByLabelText('Open function search'));

    expect(await view.findByText('Ask Arky')).toBeTruthy();
    expect(view.getByText('Library')).toBeTruthy();
    expect(view.getByText('Advanced')).toBeTruthy();
    expect(view.queryByText('Offline Map')).toBeNull();
    expect(view.queryByText('Tools')).toBeNull();
    expect(view.queryByText('Compass')).toBeNull();

    await fireEvent.changeText(view.getByLabelText('Search Ark functions'), 'compass');
    expect(await view.findByText('No matching function')).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText('Search Ark functions'), 'library');
    await fireEvent.press(await view.findByText('Library'));

    expect(routerPush).toHaveBeenCalledWith('/(tabs)/library');
  });
});
