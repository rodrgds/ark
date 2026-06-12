import { AppHeaderActionsProvider } from '@/components/layout/app-header-actions';
import { LockStateBar } from '@/components/layout/app-shell';
import { TabsChromeProvider, useTabsChrome } from '@/components/layout/tabs-chrome';
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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as React from 'react';
import { type ImageSourcePropType, View } from 'react-native';

const tabById = new Map(ARK_TABS.map((tab) => [tab.id, tab]));

const defaultPreferences: TabPreferences = {
  order: DEFAULT_TAB_ORDER,
  enabled: DEFAULT_ENABLED_TABS,
};

const TAB_ICON_SIZE = 24;
const TAB_ICON_SETTLE_SIZE = 27;
const TAB_ICON_POP_SIZE = 31;
const TAB_ICON_POP_UP_MS = 120;
const TAB_ICON_SETTLE_MS = 130;

function addHexAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

function loadMaterialTabIcon(name: string, size: number) {
  return MaterialCommunityIcons.getImageSource(name as never, size, 'white');
}

function getMaterialIconSourceKey(name: string, size: number) {
  return `${name}:${size}`;
}

export default function TabsLayout() {
  return (
    <TabsChromeProvider>
      <TabsLayoutContent />
    </TabsChromeProvider>
  );
}

function TabsLayoutContent() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;
  const navColors = NAV_COLORS[theme];
  const pathname = usePathname();
  const [preferences, setPreferences] = React.useState<TabPreferences | null>(null);
  const [materialIconSources, setMaterialIconSources] = React.useState<
    Record<string, ImageSourcePropType>
  >({});
  const [poppingRouteName, setPoppingRouteName] = React.useState<string | null>(null);
  const [iconPopPhase, setIconPopPhase] = React.useState<'peak' | 'settle' | null>(null);
  const previousActiveRouteNameRef = React.useRef<string | null>(null);
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

  const visibleTabs = React.useMemo(() => {
    if (!preferences) return [];

    const enabledTabs = new Set(preferences.enabled);
    return preferences.order
      .map((tabId) => tabById.get(tabId))
      .filter((tab): tab is NonNullable<typeof tab> => !!tab && enabledTabs.has(tab.id));
  }, [preferences]);
  const activeRouteName = pathname.split('/').filter(Boolean)[0];

  React.useEffect(() => {
    if (!visibleTabs.length) return;

    let cancelled = false;
    const iconRequests = visibleTabs.flatMap((tab) => [
      { name: tab.materialIcon.default, size: TAB_ICON_SIZE },
      { name: tab.materialIcon.selected, size: TAB_ICON_SIZE },
      { name: tab.materialIcon.selected, size: TAB_ICON_SETTLE_SIZE },
      { name: tab.materialIcon.selected, size: TAB_ICON_POP_SIZE },
    ]);

    void Promise.all(
      iconRequests.map(async ({ name, size }) => ({
        key: getMaterialIconSourceKey(name, size),
        source: await loadMaterialTabIcon(name, size),
      }))
    ).then((entries) => {
      if (cancelled) return;

      setMaterialIconSources((currentSources) => {
        const nextSources = { ...currentSources };
        for (const entry of entries) {
          if (entry.source) {
            nextSources[entry.key] = entry.source;
          }
        }
        return nextSources;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [visibleTabs]);

  React.useEffect(() => {
    if (!activeRouteName) return;

    if (previousActiveRouteNameRef.current === null) {
      previousActiveRouteNameRef.current = activeRouteName;
      return;
    }

    if (previousActiveRouteNameRef.current === activeRouteName) return;

    previousActiveRouteNameRef.current = activeRouteName;
    setPoppingRouteName(activeRouteName);
    setIconPopPhase('peak');

    const settleTimeout = setTimeout(() => {
      setIconPopPhase('settle');
    }, TAB_ICON_POP_UP_MS);
    const doneTimeout = setTimeout(() => {
      setPoppingRouteName((routeName) => (routeName === activeRouteName ? null : routeName));
      setIconPopPhase(null);
    }, TAB_ICON_POP_UP_MS + TAB_ICON_SETTLE_MS);

    return () => {
      clearTimeout(settleTimeout);
      clearTimeout(doneTimeout);
    };
  }, [activeRouteName]);

  if (!preferences) {
    return <View className="bg-background flex-1" style={{ backgroundColor: colors.background }} />;
  }

  return (
    <View className="bg-background flex-1">
      <AppHeaderActionsProvider>
        {chromeHidden ? null : <LockStateBar />}
        <NativeTabs
          backBehavior="history"
          backgroundColor={colors.card}
          badgeBackgroundColor={colors.primary}
          badgeTextColor={colors.card}
          disableTransparentOnScrollEdge
          hidden={chromeHidden}
          iconColor={{ default: navColors.mutedForeground, selected: colors.primary }}
          indicatorColor={addHexAlpha(colors.primary, '26')}
          labelVisibilityMode="labeled"
          rippleColor="transparent"
          shadowColor={colors.border}
          tintColor={colors.primary}>
          {visibleTabs.map((tab) => {
            const isActive = activeRouteName === tab.routeName;
            const androidIconName = isActive ? tab.materialIcon.selected : tab.materialIcon.default;
            const androidIconSize =
              isActive && poppingRouteName === tab.routeName
                ? iconPopPhase === 'peak'
                  ? TAB_ICON_POP_SIZE
                  : TAB_ICON_SETTLE_SIZE
                : TAB_ICON_SIZE;
            const androidIconSource =
              materialIconSources[getMaterialIconSourceKey(androidIconName, androidIconSize)];

            return (
              <NativeTabs.Trigger key={tab.id} name={tab.routeName}>
                <NativeTabs.Trigger.Icon
                  src={
                    androidIconSource ?? (
                      <NativeTabs.Trigger.VectorIcon
                        family={MaterialCommunityIcons}
                        name={androidIconName as never}
                      />
                    )
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
