import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Text } from '@/components/ui/text';
import { DEFAULT_ENABLED_TABS, type ArkTabId } from '@/constants/tabs';
import { TabPreferencesService } from '@/services/preferences/tab-preferences.service';
import { type Href, router } from 'expo-router';
import {
  Bot,
  BookOpen,
  CheckSquare,
  Clock,
  Compass,
  Download,
  Footprints,
  Gauge,
  Library,
  Lightbulb,
  LocateFixed,
  Map,
  NotebookPen,
  Ruler,
  Search,
  Newspaper,
  Settings,
  Shield,
  SlidersHorizontal,
  Smartphone,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Keyboard, Pressable, type TextInput, View } from 'react-native';

type SearchEntry = {
  title: string;
  subtitle: string;
  keywords: string;
  icon: LucideIcon;
  href: Href;
  tabId?: ArkTabId;
};

const FUNCTION_ENTRIES: SearchEntry[] = [
  {
    title: 'Ask Arky',
    subtitle: 'AI chat with downloaded references',
    keywords: 'ai arky chat assistant question',
    icon: Bot,
    href: '/(tabs)/chat',
    tabId: 'chat',
  },
  {
    title: 'Offline Map',
    subtitle: 'Map regions, saved spots, and routes',
    keywords: 'map maps offline regions spots routes location',
    icon: Map,
    href: '/(tabs)/map',
    tabId: 'map',
  },
  {
    title: 'Library',
    subtitle: 'Guides, wikis, and imported documents',
    keywords: 'library content downloads documents zim pdf guides wiki',
    icon: Library,
    href: '/(tabs)/library',
    tabId: 'library',
  },
  {
    title: 'Secure Notes',
    subtitle: 'Vault-gated notes and search',
    keywords: 'notes vault secure private documents',
    icon: NotebookPen,
    href: '/(tabs)/notes',
    tabId: 'notes',
  },
  {
    title: 'Tools',
    subtitle: 'Sensor tools and field utilities',
    keywords: 'tools sensors utility field',
    icon: Compass,
    href: '/(tabs)/tools',
    tabId: 'tools',
  },
  {
    title: 'News',
    subtitle: 'Cached feeds and unread alerts',
    keywords: 'news rss feeds alerts articles cache',
    icon: Newspaper,
    href: '/tools/news' as Href,
    tabId: 'tools',
  },
  {
    title: 'Compass',
    subtitle: 'Heading and cardinal direction',
    keywords: 'compass heading direction magnetometer',
    icon: Compass,
    href: '/tools/compass',
    tabId: 'tools',
  },
  {
    title: 'Barometer',
    subtitle: 'Pressure and trend',
    keywords: 'barometer pressure hpa weather trend',
    icon: Gauge,
    href: '/tools/barometer',
    tabId: 'tools',
  },
  {
    title: 'Level',
    subtitle: 'Pitch and roll bubble level',
    keywords: 'level pitch roll accelerometer angle',
    icon: Ruler,
    href: '/tools/level',
    tabId: 'tools',
  },
  {
    title: 'Pedometer',
    subtitle: 'Step counter',
    keywords: 'pedometer steps walking distance',
    icon: Footprints,
    href: '/tools/pedometer',
    tabId: 'tools',
  },
  {
    title: 'Light Meter',
    subtitle: 'Lux reading',
    keywords: 'light meter lux sensor',
    icon: Lightbulb,
    href: '/tools/light',
    tabId: 'tools',
  },
  {
    title: 'Coordinates',
    subtitle: 'Current position and saved spots',
    keywords: 'coordinates gps location latitude longitude',
    icon: LocateFixed,
    href: '/tools/coordinates',
    tabId: 'tools',
  },
  {
    title: 'Weather',
    subtitle: 'Cached forecast',
    keywords: 'weather forecast rain wind pressure cache',
    icon: BookOpen,
    href: '/tools/weather',
    tabId: 'tools',
  },
  {
    title: 'Readiness Checklist',
    subtitle: 'Preparedness checklist',
    keywords: 'checklist readiness preparedness supplies',
    icon: CheckSquare,
    href: '/tools/checklist',
    tabId: 'tools',
  },
  {
    title: 'Chronometer',
    subtitle: 'Stopwatch and elapsed time',
    keywords: 'chronometer stopwatch timer elapsed time',
    icon: Clock,
    href: '/tools/chronometer',
    tabId: 'tools',
  },
  {
    title: 'Diagnostics',
    subtitle: 'Native capabilities and offline storage',
    keywords: 'diagnostics native status storage sensors advanced',
    icon: Smartphone,
    href: { pathname: '/(tabs)/settings', params: { tab: 'advanced' } },
  },
  {
    title: 'Appearance Settings',
    subtitle: 'Theme and battery reduce mode',
    keywords: 'settings appearance theme battery reduce mode power display',
    icon: SlidersHorizontal,
    href: { pathname: '/(tabs)/settings', params: { tab: 'appearance' } },
  },
  {
    title: 'Security Settings',
    subtitle: 'Vault, biometrics, and passphrase',
    keywords: 'settings security vault biometrics password passphrase lock',
    icon: Shield,
    href: { pathname: '/(tabs)/settings', params: { tab: 'security' } },
  },
  {
    title: 'AI Settings',
    subtitle: 'Model selector and local runtime',
    keywords: 'settings ai model llama gguf selector arky',
    icon: Bot,
    href: { pathname: '/(tabs)/settings', params: { tab: 'ai' } },
  },
  {
    title: 'Downloads',
    subtitle: 'Offline files and map regions',
    keywords: 'settings downloads storage maps guides models retry failed offline',
    icon: Download,
    href: { pathname: '/(tabs)/settings', params: { tab: 'downloads' } },
  },
  {
    title: 'Advanced',
    subtitle: 'Storage and diagnostics',
    keywords: 'settings storage disk files directories diagnostics advanced',
    icon: Settings,
    href: { pathname: '/(tabs)/settings', params: { tab: 'advanced' } },
  },
];

export function FunctionSearchButton() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [enabledTabs, setEnabledTabs] = React.useState<ReadonlySet<ArkTabId>>(
    () => new Set(DEFAULT_ENABLED_TABS)
  );
  const inputRef = React.useRef<TextInput>(null);
  const focusTimersRef = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const loadTabPreferences = React.useCallback(() => {
    void TabPreferencesService.getPreferences()
      .then((preferences) => setEnabledTabs(new Set(preferences.enabled)))
      .catch(() => setEnabledTabs(new Set(DEFAULT_ENABLED_TABS)));
  }, []);

  React.useEffect(() => {
    loadTabPreferences();
    return TabPreferencesService.subscribe(loadTabPreferences);
  }, [loadTabPreferences]);

  const results = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visibleEntries = FUNCTION_ENTRIES.filter(
      (entry) => !entry.tabId || enabledTabs.has(entry.tabId)
    );
    if (!normalized) return visibleEntries;
    return visibleEntries.filter((entry) =>
      `${entry.title} ${entry.subtitle} ${entry.keywords}`.toLowerCase().includes(normalized)
    );
  }, [enabledTabs, query]);

  function openEntry(entry: SearchEntry) {
    inputRef.current?.blur();
    Keyboard.dismiss();
    setOpen(false);
    setQuery('');
    router.push(entry.href);
  }

  function closeSearch() {
    inputRef.current?.blur();
    Keyboard.dismiss();
    setOpen(false);
  }

  const focusInput = React.useCallback(() => {
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());
    focusTimersRef.current.forEach(clearTimeout);
    focusTimersRef.current = [80, 180, 320].map((delay) =>
      setTimeout(() => inputRef.current?.focus(), delay)
    );
  }, []);

  React.useEffect(() => {
    if (!open) {
      focusTimersRef.current.forEach(clearTimeout);
      focusTimersRef.current = [];
      return;
    }
    const focusTimer = setTimeout(() => {
      focusInput();
    }, 260);
    return () => {
      clearTimeout(focusTimer);
      focusTimersRef.current.forEach(clearTimeout);
      focusTimersRef.current = [];
    };
  }, [focusInput, open]);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        accessibilityLabel="Open function search"
        onPress={() => setOpen(true)}
        className="h-9 w-9 rounded-full">
        <Icon as={Search} className="size-4" />
      </Button>

      <ArkBottomSheet
        visible={open}
        onDismiss={closeSearch}
        scrollable
        snapPoints={['82%']}
        enableKeyboardAwareScroll={false}
        contentClassName="gap-3">
        <Pressable
          accessibilityRole="none"
          onPress={focusInput}
          className="border-border bg-card h-11 min-h-11 flex-row items-center gap-2 rounded-md border px-3">
          <Icon as={Search} className="text-muted-foreground size-4" />
          <Input
            ref={inputRef}
            className="h-11 min-h-11 flex-1 border-0 bg-transparent px-0 py-2"
            value={query}
            onChangeText={setQuery}
            placeholder="Search Ark"
            autoFocus
            showSoftInputOnFocus
            returnKeyType="search"
            accessibilityLabel="Search Ark functions"
          />
        </Pressable>

        <View className="gap-1">
          {results.map((entry) => (
            <Pressable
              key={`${entry.title}-${typeof entry.href === 'string' ? entry.href : entry.href.pathname}`}
              accessibilityRole="button"
              onPress={() => openEntry(entry)}
              className="active:bg-accent flex-row items-center gap-3 rounded-md p-3">
              <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-full">
                <Icon as={entry.icon} className="text-primary size-5" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-semibold" numberOfLines={1}>
                  {entry.title}
                </Text>
                <Text variant="muted" className="leading-5" numberOfLines={2}>
                  {entry.subtitle}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {results.length === 0 ? (
          <View className="items-center gap-2 py-6">
            <Text variant="large">No matching function</Text>
            <Text variant="muted" className="text-center">
              Try map, notes, weather, AI, security, or diagnostics.
            </Text>
          </View>
        ) : null}
      </ArkBottomSheet>
    </>
  );
}
