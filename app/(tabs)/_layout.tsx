import { Icon } from '@/components/ui/icon';
import { LockStateBar } from '@/components/layout/app-shell';
import { NAV_COLORS } from '@/constants/theme';
import { NAV_THEME } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';
import { Tabs } from 'expo-router';
import { Bot, BookOpen, Compass, Home, Map, NotebookPen, Settings } from 'lucide-react-native';
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
  const colors = NAV_THEME[theme].colors;

  return (
    <View className="bg-background flex-1">
      <LockStateBar />
      <Tabs
        screenOptions={({ route }) => ({
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
        <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
        <Tabs.Screen name="map" options={{ title: 'Map' }} />
        <Tabs.Screen name="library" options={{ title: 'Library' }} />
        <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
        <Tabs.Screen name="tools" options={{ title: 'Tools' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </View>
  );
}
