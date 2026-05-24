import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ModalFrame } from '@/components/ui/modal-frame';
import { Text } from '@/components/ui/text';
import { type Href, router } from 'expo-router';
import {
  Bot,
  BookOpen,
  CheckSquare,
  Clock,
  Compass,
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
import {
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  type TextInput,
  View,
} from 'react-native';

type SearchEntry = {
  title: string;
  subtitle: string;
  keywords: string;
  icon: LucideIcon;
  href: Href;
};

const FUNCTION_ENTRIES: SearchEntry[] = [
  {
    title: 'Ask Arky',
    subtitle: 'AI chat with downloaded references',
    keywords: 'ai arky chat assistant question',
    icon: Bot,
    href: '/(tabs)/chat',
  },
  {
    title: 'Offline Map',
    subtitle: 'Map regions, saved spots, and routes',
    keywords: 'map maps offline regions spots routes location',
    icon: Map,
    href: '/(tabs)/map',
  },
  {
    title: 'Library',
    subtitle: 'Guides, wikis, and imported documents',
    keywords: 'library content downloads documents zim pdf guides wiki',
    icon: Library,
    href: '/(tabs)/library',
  },
  {
    title: 'Secure Notes',
    subtitle: 'Vault-gated notes and search',
    keywords: 'notes vault secure private documents',
    icon: NotebookPen,
    href: '/(tabs)/notes',
  },
  {
    title: 'Tools',
    subtitle: 'Sensor tools and field utilities',
    keywords: 'tools sensors utility field',
    icon: Compass,
    href: '/(tabs)/tools',
  },
  {
    title: 'News',
    subtitle: 'Cached feeds and unread alerts',
    keywords: 'news rss feeds alerts articles cache',
    icon: Newspaper,
    href: '/tools/news',
  },
  {
    title: 'Compass',
    subtitle: 'Heading and cardinal direction',
    keywords: 'compass heading direction magnetometer',
    icon: Compass,
    href: '/tools/compass',
  },
  {
    title: 'Barometer',
    subtitle: 'Pressure and trend',
    keywords: 'barometer pressure hpa weather trend',
    icon: Gauge,
    href: '/tools/barometer',
  },
  {
    title: 'Level',
    subtitle: 'Pitch and roll bubble level',
    keywords: 'level pitch roll accelerometer angle',
    icon: Ruler,
    href: '/tools/level',
  },
  {
    title: 'Pedometer',
    subtitle: 'Step counter',
    keywords: 'pedometer steps walking distance',
    icon: Footprints,
    href: '/tools/pedometer',
  },
  {
    title: 'Light Meter',
    subtitle: 'Lux reading',
    keywords: 'light meter lux sensor',
    icon: Lightbulb,
    href: '/tools/light',
  },
  {
    title: 'Coordinates',
    subtitle: 'Current position and saved spots',
    keywords: 'coordinates gps location latitude longitude',
    icon: LocateFixed,
    href: '/tools/coordinates',
  },
  {
    title: 'Weather',
    subtitle: 'Cached forecast',
    keywords: 'weather forecast rain wind pressure cache',
    icon: BookOpen,
    href: '/tools/weather',
  },
  {
    title: 'Readiness Checklist',
    subtitle: 'Preparedness checklist',
    keywords: 'checklist readiness preparedness supplies',
    icon: CheckSquare,
    href: '/tools/checklist',
  },
  {
    title: 'Chronometer',
    subtitle: 'Stopwatch and elapsed time',
    keywords: 'chronometer stopwatch timer elapsed time',
    icon: Clock,
    href: '/tools/chronometer',
  },
  {
    title: 'Diagnostics',
    subtitle: 'Native capabilities and storage report',
    keywords: 'diagnostics native status storage sensors',
    icon: Smartphone,
    href: '/tools/diagnostics',
  },
  {
    title: 'Appearance Settings',
    subtitle: 'Theme and motion',
    keywords: 'settings appearance theme motion display',
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
    title: 'Storage Settings',
    subtitle: 'Offline storage and directories',
    keywords: 'settings storage disk files directories',
    icon: Settings,
    href: { pathname: '/(tabs)/settings', params: { tab: 'storage' } },
  },
];

export function FunctionSearchButton() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<TextInput>(null);

  const results = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return FUNCTION_ENTRIES;
    return FUNCTION_ENTRIES.filter((entry) =>
      `${entry.title} ${entry.subtitle} ${entry.keywords}`.toLowerCase().includes(normalized)
    );
  }, [query]);

  function openEntry(entry: SearchEntry) {
    setOpen(false);
    setQuery('');
    router.push(entry.href);
  }

  React.useEffect(() => {
    if (!open) return;
    const task = InteractionManager.runAfterInteractions(() => {
      inputRef.current?.focus();
    });
    return () => task.cancel();
  }, [open]);

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

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <ModalFrame
          onDismiss={() => setOpen(false)}
          position="top"
          containerClassName="px-4 pt-16"
          surfaceClassName="max-h-[82%] gap-3 p-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Search} className="text-muted-foreground size-4" />
            <Input
              ref={inputRef}
              className="h-11 min-h-11 flex-1 py-2"
              value={query}
              onChangeText={setQuery}
              placeholder="Search Ark"
              autoFocus
              returnKeyType="search"
              accessibilityLabel="Search Ark functions"
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
          </ScrollView>
        </ModalFrame>
      </Modal>
    </>
  );
}
