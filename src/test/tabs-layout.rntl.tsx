import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { TabPreferences } from '@/services/preferences/tab-preferences.service';

installCommonRntlMocks(mock);

const { render, waitFor } = await import('@testing-library/react-native');

let preferences: TabPreferences = {
  order: ['tools', 'chat', 'library', 'map', 'notes', 'settings'],
  enabled: ['chat', 'library', 'settings'],
};

const getPreferences = mock(async () => preferences);
const refreshRss = mock(async () => undefined);
const refreshWeather = mock(async () => undefined);

mock.module('@/components/layout/app-header-actions', () => ({
  AppHeaderActionsProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

mock.module('@/components/layout/app-shell', () => ({
  LockStateBar: () => null,
}));

mock.module('@/lib/theme', () => ({
  NAV_THEME: {
    oled: {
      colors: {
        border: '#111111',
        card: '#000000',
        primary: '#F2B84B',
      },
    },
  },
}));

mock.module('@/services/preferences/tab-preferences.service', () => ({
  TabPreferencesService: {
    getPreferences,
    subscribe: () => () => undefined,
  },
}));

mock.module('@/services/rss/rss.service', () => ({
  RssService: {
    refreshIfStale: refreshRss,
  },
}));

mock.module('@/services/weather/weather-cache.service', () => ({
  WeatherCacheService: {
    refreshIfStale: refreshWeather,
  },
}));

mock.module('expo-router/unstable-native-tabs', () => {
  function NativeTabs({ children }: React.PropsWithChildren) {
    return React.createElement('View', { accessibilityRole: 'tablist' }, children);
  }
  function Trigger({
    name,
    children,
  }: React.PropsWithChildren<{
    name: string;
  }>) {
    return React.createElement(
      'View',
      {
        accessibilityLabel: `Tab ${name}`,
        accessibilityRole: 'tab',
        accessible: true,
        routeName: name,
      },
      children
    );
  }
  Trigger.Icon = function TriggerIcon() {
    return React.createElement('View');
  };
  Trigger.VectorIcon = function TriggerVectorIcon() {
    return React.createElement('View');
  };
  Trigger.Label = function TriggerLabel({ children }: React.PropsWithChildren) {
    return React.createElement('Text', null, children);
  };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

describe('TabsLayout', () => {
  beforeEach(() => {
    preferences = {
      order: ['tools', 'chat', 'library', 'map', 'notes', 'settings'],
      enabled: ['chat', 'library', 'settings'],
    };
    getPreferences.mockClear();
    refreshRss.mockClear();
    refreshWeather.mockClear();
  });

  test('renders enabled native tabs in persisted order only', async () => {
    const { default: TabsLayout } = await import('@/app/(tabs)/_layout');
    const view = await render(<TabsLayout />);

    await waitFor(() => {
      expect(view.queryByText('Map')).toBeNull();
    });

    expect(view.queryByText('Tools')).toBeNull();
    expect(view.queryByText('Notes')).toBeNull();
    expect(view.getByText('Arky')).toBeTruthy();
    expect(view.getByText('Library')).toBeTruthy();
    expect(view.getByText('Settings')).toBeTruthy();
    expect(view.getAllByRole('tab').map((tab) => tab.props.routeName)).toEqual([
      'chat',
      'library',
      'settings',
    ]);
    expect(getPreferences).toHaveBeenCalled();
    expect(refreshRss).toHaveBeenCalled();
    expect(refreshWeather).toHaveBeenCalled();
  });
});
