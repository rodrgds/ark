import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import {
  Bot,
  BookOpen,
  CheckSquare,
  Compass,
  Footprints,
  Gauge,
  Home,
  Library,
  Lightbulb,
  LocateFixed,
  Map,
  NotebookPen,
  Ruler,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Smartphone,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { InteractionManager, Modal, Pressable, ScrollView, type TextInput, View } from 'react-native';

type SearchEntry = {
  title: string;
  subtitle: string;
  keywords: string;
  icon: LucideIcon;
  pathname: string;
  params?: Record<string, string>;
};

const FUNCTION_ENTRIES: SearchEntry[] = [
  {
    title: 'Home',
    subtitle: 'Status dashboard and quick actions',
    keywords: 'dashboard status home readiness',
    icon: Home,
    pathname: '/(tabs)',
  },
  {
    title: 'Ask Arky',
    subtitle: 'AI chat with downloaded references',
    keywords: 'ai arky chat assistant rag question',
    icon: Bot,
    pathname: '/(tabs)/chat',
  },
  {
    title: 'Offline Map',
    subtitle: 'Map regions, saved spots, and routes',
    keywords: 'map maps offline regions spots routes location',
    icon: Map,
    pathname: '/(tabs)/map',
  },
  {
    title: 'Library',
    subtitle: 'Content packs, RSS, documents, and models',
    keywords: 'library content downloads documents rss models zim pdf',
    icon: Library,
    pathname: '/(tabs)/library',
  },
  {
    title: 'Secure Notes',
    subtitle: 'Vault-gated notes and search',
    keywords: 'notes vault secure private documents',
    icon: NotebookPen,
    pathname: '/(tabs)/notes',
  },
  {
    title: 'Tools',
    subtitle: 'Sensor tools and field utilities',
    keywords: 'tools sensors utility field',
    icon: Compass,
    pathname: '/(tabs)/tools',
  },
  {
    title: 'Compass',
    subtitle: 'Heading and cardinal direction',
    keywords: 'compass heading direction magnetometer',
    icon: Compass,
    pathname: '/tools/compass',
  },
  {
    title: 'Barometer',
    subtitle: 'Pressure and trend',
    keywords: 'barometer pressure hpa weather trend',
    icon: Gauge,
    pathname: '/tools/barometer',
  },
  {
    title: 'Level',
    subtitle: 'Pitch and roll bubble level',
    keywords: 'level pitch roll accelerometer angle',
    icon: Ruler,
    pathname: '/tools/level',
  },
  {
    title: 'Pedometer',
    subtitle: 'Step counter',
    keywords: 'pedometer steps walking distance',
    icon: Footprints,
    pathname: '/tools/pedometer',
  },
  {
    title: 'Light Meter',
    subtitle: 'Lux reading',
    keywords: 'light meter lux sensor',
    icon: Lightbulb,
    pathname: '/tools/light',
  },
  {
    title: 'Coordinates',
    subtitle: 'Current position and saved spots',
    keywords: 'coordinates gps location latitude longitude',
    icon: LocateFixed,
    pathname: '/tools/coordinates',
  },
  {
    title: 'Weather',
    subtitle: 'Cached forecast',
    keywords: 'weather forecast rain wind pressure cache',
    icon: BookOpen,
    pathname: '/tools/weather',
  },
  {
    title: 'Readiness Checklist',
    subtitle: 'Preparedness checklist',
    keywords: 'checklist readiness preparedness supplies',
    icon: CheckSquare,
    pathname: '/tools/checklist',
  },
  {
    title: 'Diagnostics',
    subtitle: 'Native capabilities and storage report',
    keywords: 'diagnostics native status storage sensors',
    icon: Smartphone,
    pathname: '/tools/diagnostics',
  },
  {
    title: 'Appearance Settings',
    subtitle: 'Theme and motion',
    keywords: 'settings appearance theme motion display',
    icon: SlidersHorizontal,
    pathname: '/(tabs)/settings',
    params: { tab: 'appearance' },
  },
  {
    title: 'Security Settings',
    subtitle: 'Vault, biometrics, and passphrase',
    keywords: 'settings security vault biometrics password passphrase lock',
    icon: Shield,
    pathname: '/(tabs)/settings',
    params: { tab: 'security' },
  },
  {
    title: 'AI Settings',
    subtitle: 'Model selector and local runtime',
    keywords: 'settings ai model llama gguf selector arky',
    icon: Bot,
    pathname: '/(tabs)/settings',
    params: { tab: 'ai' },
  },
  {
    title: 'Storage Settings',
    subtitle: 'Offline storage and directories',
    keywords: 'settings storage disk files directories',
    icon: Settings,
    pathname: '/(tabs)/settings',
    params: { tab: 'storage' },
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
    router.push({ pathname: entry.pathname as never, params: entry.params } as never);
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
      <Button size="icon" variant="ghost" onPress={() => setOpen(true)}>
        <Icon as={Search} className="size-5" />
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/60 p-4 pt-16" onPress={() => setOpen(false)}>
          <Pressable className="bg-card border-border max-h-[82%] gap-3 rounded-lg border p-3">
            <View className="flex-row items-center gap-2">
              <Icon as={Search} className="text-muted-foreground size-5" />
              <Input
                ref={inputRef}
                className="h-11 min-h-11 flex-1 py-2"
                value={query}
                onChangeText={setQuery}
                placeholder="Search Ark"
                autoFocus
                returnKeyType="search"
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
              {results.map((entry) => (
                <Button
                  key={`${entry.pathname}-${entry.title}`}
                  className="h-auto justify-start px-3 py-3"
                  variant="ghost"
                  onPress={() => openEntry(entry)}>
                  <Icon as={entry.icon} className="text-primary size-5" />
                  <View className="min-w-0 flex-1 items-start gap-1">
                    <Text numberOfLines={1}>{entry.title}</Text>
                    <Text variant="muted" className="font-normal" numberOfLines={1}>
                      {entry.subtitle}
                    </Text>
                  </View>
                </Button>
              ))}
              {results.length === 0 ? (
                <View className="items-center gap-2 py-6">
                  <Text variant="large">No matching function</Text>
                  <Text variant="muted" className="text-center">
                    Try map, notes, weather, AI, security, or diagnostics.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
