import { AppHeaderActionsProvider } from '@/components/layout/app-header-actions';
import { LockStateBar } from '@/components/layout/app-shell';
import { ARK_TABS, DEFAULT_ENABLED_TABS, DEFAULT_TAB_ORDER } from '@/constants/tabs';
import { NAV_COLORS } from '@/constants/theme';
import { NAV_THEME } from '@/lib/theme';
import {
  TabPreferencesService,
  type TabPreferences,
} from '@/services/preferences/tab-preferences.service';
import { RssService } from '@/services/rss/rss.service';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
import { useThemeStore } from '@/stores/theme-store';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as React from 'react';
import { View } from 'react-native';

const tabById = new Map(ARK_TABS.map((tab) => [tab.id, tab]));

const defaultPreferences: TabPreferences = {
  order: DEFAULT_TAB_ORDER,
  enabled: DEFAULT_ENABLED_TABS,
};

function addHexAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

export default function TabsLayout() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;
  const navColors = NAV_COLORS[theme];
  const [preferences, setPreferences] = React.useState<TabPreferences | null>(null);

  const loadTabPreferences = React.useCallback(() => {
    void TabPreferencesService.getPreferences().then(setPreferences).catch(() => {
      setPreferences(defaultPreferences);
    });
  }, []);

  React.useEffect(() => {
    loadTabPreferences();
    return TabPreferencesService.subscribe(loadTabPreferences);
  }, [loadTabPreferences]);

  React.useEffect(() => {
    void RssService.refreshIfStale().catch(() => undefined);
    void WeatherCacheService.refreshIfStale().catch(() => undefined);
    const refreshInterval = setInterval(
      () => {
        void RssService.refreshIfStale().catch(() => undefined);
        void WeatherCacheService.refreshIfStale().catch(() => undefined);
      },
      30 * 60 * 1000
    );
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  if (!preferences) {
    return <View className="bg-background flex-1" style={{ backgroundColor: colors.background }} />;
  }

  const enabledTabs = new Set(preferences.enabled);
  const visibleTabs = preferences.order
    .map((tabId) => tabById.get(tabId))
    .filter((tab): tab is NonNullable<typeof tab> => !!tab && enabledTabs.has(tab.id));

  return (
    <View className="bg-background flex-1">
      <AppHeaderActionsProvider>
        <LockStateBar />
        <NativeTabs
          backBehavior="history"
          backgroundColor={colors.card}
          badgeBackgroundColor={colors.primary}
          badgeTextColor={colors.card}
          disableTransparentOnScrollEdge
          iconColor={{ default: navColors.mutedForeground, selected: colors.primary }}
          indicatorColor={addHexAlpha(colors.primary, '26')}
          labelVisibilityMode="labeled"
          shadowColor={colors.border}
          tintColor={colors.primary}>
          {visibleTabs.map((tab) => (
            <NativeTabs.Trigger key={tab.id} name={tab.routeName}>
              <NativeTabs.Trigger.Icon
                md={tab.materialIcon as never}
                sf={tab.sfSymbol as never}
              />
              <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
          ))}
        </NativeTabs>
      </AppHeaderActionsProvider>
    </View>
  );
}
