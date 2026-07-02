import { AppHeaderActionsProvider } from '@/components/layout/app-header-actions';
import { LockStateBar } from '@/components/layout/app-shell';
import { TabsChromeProvider, useTabsChrome } from '@/components/layout/tabs-chrome';
import { ARK_TABS, DEFAULT_ENABLED_TABS, DEFAULT_TAB_ORDER } from '@/constants/tabs';
import {
  TabPreferencesService,
  type TabPreferences,
} from '@/services/preferences/tab-preferences.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { RssService } from '@/services/rss/rss.service';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
import { useThemeStore } from '@/stores/theme-store';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const tabById = new Map(ARK_TABS.map((tab) => [tab.id, tab]));

const defaultPreferences: TabPreferences = {
  order: DEFAULT_TAB_ORDER,
  enabled: DEFAULT_ENABLED_TABS,
};

function addHexAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

export default function TabsLayout() {
  return (
    <TabsChromeProvider>
      <TabsLayoutContent />
    </TabsChromeProvider>
  );
}

function TabsLayoutContent() {
  const colors = useThemeStore((state) => state.colors);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [preferences, setPreferences] = React.useState<TabPreferences | null>(null);
  const [topHeaderEnabled, setTopHeaderEnabled] = React.useState(true);
  const { chromeHidden } = useTabsChrome();

  const loadTabPreferences = React.useCallback(() => {
    void TabPreferencesService.getPreferences()
      .then(setPreferences)
      .catch(() => {
        setPreferences(defaultPreferences);
      });
  }, []);

  React.useEffect(() => {
    loadTabPreferences();
    return TabPreferencesService.subscribe(loadTabPreferences);
  }, [loadTabPreferences]);

  React.useEffect(() => {
    void PreferencesService.getTopHeaderEnabled()
      .then(setTopHeaderEnabled)
      .catch(() => setTopHeaderEnabled(true));
    return PreferencesService.subscribeTopHeaderEnabled(setTopHeaderEnabled);
  }, []);

  React.useEffect(() => {
    const initialRefresh = setTimeout(() => {
      void RssService.refreshIfStale().catch(() => undefined);
      void WeatherCacheService.refreshIfStale().catch(() => undefined);
    }, 1800);
    const refreshInterval = setInterval(
      () => {
        void RssService.refreshIfStale().catch(() => undefined);
        void WeatherCacheService.refreshIfStale().catch(() => undefined);
      },
      30 * 60 * 1000
    );
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(refreshInterval);
    };
  }, []);

  const visibleTabs = React.useMemo(() => {
    if (!preferences) return [];

    const enabledTabs = new Set(preferences.enabled);
    return preferences.order
      .map((tabId) => tabById.get(tabId))
      .filter((tab): tab is NonNullable<typeof tab> => !!tab && enabledTabs.has(tab.id));
  }, [preferences]);
  const activeRouteName = pathname.split('/').filter(Boolean)[0];

  if (!preferences) {
    return <View className="bg-background flex-1" style={{ backgroundColor: colors.background }} />;
  }

  return (
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      <AppHeaderActionsProvider>
        {chromeHidden ? null : topHeaderEnabled ? (
          <LockStateBar />
        ) : (
          <View style={{ height: insets.top, backgroundColor: colors.background }} />
        )}
        <NativeTabs
          backBehavior="history"
          backgroundColor={colors.card}
          badgeBackgroundColor={colors.primary}
          badgeTextColor={colors.card}
          disableTransparentOnScrollEdge
          hidden={chromeHidden}
          iconColor={{ default: colors.mutedForeground, selected: colors.primary }}
          indicatorColor={addHexAlpha(colors.primary, '26')}
          labelVisibilityMode="labeled"
          rippleColor="transparent"
          shadowColor={colors.border}
          tintColor={colors.primary}>
          {visibleTabs.map((tab) => {
            const isActive = activeRouteName === tab.routeName;
            const tabContentBackground = colors.background;
            const androidIconName = isActive ? tab.materialIcon.selected : tab.materialIcon.default;

            return (
              <NativeTabs.Trigger
                key={tab.id}
                name={tab.routeName}
                contentStyle={{ backgroundColor: tabContentBackground }}>
                <NativeTabs.Trigger.Icon
                  src={
                    <NativeTabs.Trigger.VectorIcon
                      family={MaterialCommunityIcons}
                      name={androidIconName as never}
                    />
                  }
                  sf={tab.sfSymbol as never}
                />
                <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
              </NativeTabs.Trigger>
            );
          })}
        </NativeTabs>
      </AppHeaderActionsProvider>
    </View>
  );
}
