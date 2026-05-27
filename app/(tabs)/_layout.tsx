import { Icon } from '@/components/ui/icon';
import { AppHeaderActionsProvider } from '@/components/layout/app-header-actions';
import { LockStateBar } from '@/components/layout/app-shell';
import { NAV_COLORS } from '@/constants/theme';
import { NAV_THEME } from '@/lib/theme';
import { RssService } from '@/services/rss/rss.service';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
import { useThemeStore } from '@/stores/theme-store';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { Bot, BookOpen, Compass, Map, NotebookPen, Settings } from 'lucide-react-native';
import * as React from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const icons = {
  chat: Bot,
  'chat/index': Bot,
  map: Map,
  library: BookOpen,
  notes: NotebookPen,
  tools: Compass,
  settings: Settings,
};

const tabLabels = {
  chat: 'Arky',
  'chat/index': 'Arky',
  map: 'Map',
  library: 'Library',
  notes: 'Notes',
  tools: 'Tools',
  settings: 'Settings',
};

const ACTIVE_GLOW_SIZE = 58;
const visibleTabRoutes = new Set(['chat', 'chat/index', 'map', 'library', 'notes', 'tools', 'settings']);

export default function TabsLayout() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;

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

  return (
    <View className="bg-background flex-1">
      <AppHeaderActionsProvider>
        <LockStateBar />
        <Tabs
          tabBar={(props) => <ArkTabBar {...props} theme={theme} />}
          screenOptions={({ route }) => ({
            headerShown: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: NAV_COLORS[theme].mutedForeground,
            sceneStyle: { backgroundColor: colors.background },
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'notes') {
                return <Icon as={NotebookPen} color={color} size={size} />;
              }

              const Component = icons[route.name as keyof typeof icons] ?? Bot;
              return <Icon as={Component} color={color} size={size} />;
            },
          })}>
          <Tabs.Screen name="index" options={{ href: null }} />
          <Tabs.Screen name="chat/index" options={{ title: 'Arky' }} />
          <Tabs.Screen
            name="chat/[threadId]"
            options={{ href: null, tabBarStyle: { display: 'none' } }}
          />
          <Tabs.Screen name="map" options={{ title: 'Map' }} />
          <Tabs.Screen
            name="library"
            options={{
              title: 'Library',
            }}
          />
          <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
          <Tabs.Screen name="tools" options={{ title: 'Tools' }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        </Tabs>
      </AppHeaderActionsProvider>
    </View>
  );
}

function ArkTabBar({
  descriptors,
  navigation,
  state,
  theme,
}: BottomTabBarProps & { theme: keyof typeof NAV_COLORS }) {
  const insets = useSafeAreaInsets();
  const [rowWidth, setRowWidth] = React.useState(0);
  const colors = NAV_THEME[theme].colors;
  const navColors = NAV_COLORS[theme];
  const glowOuterColor = addHexAlpha(colors.primary, theme === 'light' ? '14' : '18');
  const glowMiddleColor = addHexAlpha(colors.primary, theme === 'light' ? '20' : '24');
  const glowInnerColor = addHexAlpha(colors.primary, theme === 'light' ? '28' : '30');
  const activeOptions = descriptors[state.routes[state.index].key]?.options;
  const activeTabStyle = activeOptions?.tabBarStyle;
  const routes = state.routes.filter((route) => visibleTabRoutes.has(route.name));
  const activeRouteKey = state.routes[state.index]?.key;
  const activeIndex = Math.max(
    0,
    routes.findIndex((route) => route.key === activeRouteKey)
  );
  const glowX = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (!rowWidth || routes.length === 0) {
      glowOpacity.value = withTiming(0, { duration: 120 });
      return;
    }

    const itemWidth = rowWidth / routes.length;
    const nextX = itemWidth * activeIndex + itemWidth / 2 - ACTIVE_GLOW_SIZE / 2;
    glowX.value = withTiming(nextX, {
      duration: 230,
      easing: Easing.out(Easing.cubic),
    });
    glowOpacity.value = withTiming(1, { duration: 140 });
  }, [activeIndex, glowOpacity, glowX, routes.length, rowWidth]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ translateX: glowX.value }],
  }));

  if (
    activeTabStyle &&
    typeof activeTabStyle === 'object' &&
    !Array.isArray(activeTabStyle) &&
    'display' in activeTabStyle &&
    activeTabStyle.display === 'none'
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.tabBarRoot,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom + 8, 26),
        },
      ]}>
      <View style={styles.tabRow} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
        {rowWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.activeGlow, { backgroundColor: glowOuterColor }, glowStyle]}>
            <View style={[styles.activeGlowMiddle, { backgroundColor: glowMiddleColor }]}>
              <View style={[styles.activeGlowInner, { backgroundColor: glowInnerColor }]} />
            </View>
          </Animated.View>
        ) : null}
        {routes.map((route) => {
          const focused = state.routes[state.index].key === route.key;
          const options = descriptors[route.key].options;
          const color = focused ? colors.primary : navColors.mutedForeground;
          const tabKey = route.name as keyof typeof tabLabels;
          const IconComponent = icons[tabKey] ?? Bot;
          const label =
            tabLabels[tabKey] ??
            (typeof options.title === 'string' ? options.title : route.name);

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: 'tabPress',
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              target: route.key,
              type: 'tabLongPress',
            });
          };

          return (
            <PlatformPressable
              key={route.key}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : undefined}
              onLongPress={onLongPress}
              onPress={onPress}
              pressOpacity={0.82}
              style={styles.tabItem}>
              <View style={styles.iconShell}>
                {route.name === 'chat' || route.name === 'chat/index' ? (
                  <Image
                    source={require('@/assets/images/arky/normal.png')}
                    style={[styles.arkyTabIcon, { opacity: focused ? 1 : 0.74 }]}
                    contentFit="contain"
                  />
                ) : (
                  <Icon as={IconComponent} color={color} size={26} />
                )}
              </View>
              <RNText
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: focused ? '700' : '500',
                  },
                ]}>
                {label}
              </RNText>
            </PlatformPressable>
          );
        })}
      </View>
    </View>
  );
}

function addHexAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

const styles = StyleSheet.create({
  activeGlow: {
    alignItems: 'center',
    borderRadius: 999,
    height: ACTIVE_GLOW_SIZE,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: -9,
    width: ACTIVE_GLOW_SIZE,
    zIndex: 0,
  },
  activeGlowInner: {
    borderRadius: 999,
    height: 28,
    width: 28,
  },
  activeGlowMiddle: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  arkyTabIcon: {
    height: 30,
    width: 30,
  },
  iconShell: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tabBarRoot: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 15,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'flex-start',
    minWidth: 0,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  tabRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    position: 'relative',
  },
});
