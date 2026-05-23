import { Icon } from '@/components/ui/icon';
import { LockStateBar } from '@/components/layout/app-shell';
import { NAV_COLORS } from '@/constants/theme';
import { NAV_THEME } from '@/lib/theme';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { RssService } from '@/services/rss/rss.service';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { Tabs } from 'expo-router';
import { Bot, BookOpen, Compass, Home, Map, NotebookPen, Settings } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const icons = {
  index: Home,
  chat: Bot,
  map: Map,
  library: BookOpen,
  notes: NotebookPen,
  tools: Compass,
  settings: Settings,
};

export default function TabsLayout() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const unlocked = useAuthStore((state) => state.unlocked);
  const colors = NAV_THEME[theme].colors;
  const [pendingDownloads, setPendingDownloads] = React.useState(0);
  const [rssItems, setRssItems] = React.useState(0);
  const [plannedRegions, setPlannedRegions] = React.useState(0);

  async function loadBadges() {
    const [downloads, rss, regions] = await Promise.all([
      DownloadManagerService.listDownloads(),
      RssService.getOverview(),
      OfflineMapService.listRegions(),
    ]);
    setPendingDownloads(
      downloads.filter(
        (download) =>
          download.status === 'queued' ||
          download.status === 'downloading' ||
          download.status === 'verifying'
      ).length
    );
    setRssItems(rss.recentItems.length);
    setPlannedRegions(regions.length);
  }

  React.useEffect(() => {
    void loadBadges();
    const interval = setInterval(() => {
      void loadBadges();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="bg-background flex-1">
      <LockStateBar />
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: NAV_COLORS[theme].mutedForeground,
          sceneStyle: { backgroundColor: colors.background },
          tabBarIcon: ({ color, size }) => {
            const Component = icons[route.name as keyof typeof icons] ?? Home;
            return <Icon as={Component} color={color} size={size} />;
          },
        })}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="chat" options={{ title: 'Ask Arky' }} />
        <Tabs.Screen
          name="map"
          options={{ title: 'Map', tabBarBadge: plannedRegions || undefined }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarBadge: pendingDownloads || rssItems || undefined,
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{ title: 'Notes', tabBarBadge: unlocked ? undefined : 'Lock' }}
        />
        <Tabs.Screen name="tools" options={{ title: 'Tools' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </View>
  );
}
