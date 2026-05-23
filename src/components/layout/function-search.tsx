import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { type Href, router } from 'expo-router';
import {
  Bot,
  BookOpen,
  Compass,
  Home,
  Lock,
  Map,
  NotebookPen,
  Search,
  Settings,
} from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

type FunctionItem = {
  label: string;
  description: string;
  href: Href;
  icon: React.ComponentProps<typeof Icon>['as'];
};

const FUNCTIONS: FunctionItem[] = [
  {
    label: 'Home',
    description: 'Readiness status and quick actions',
    href: '/(tabs)',
    icon: Home,
  },
  {
    label: 'Ask Arky',
    description: 'Offline assistant with local context',
    href: '/(tabs)/chat',
    icon: Bot,
  },
  {
    label: 'Map',
    description: 'Saved places, routes, and offline regions',
    href: '/(tabs)/map',
    icon: Map,
  },
  {
    label: 'Library',
    description: 'Guides, ZIM archives, documents, and feeds',
    href: '/(tabs)/library',
    icon: BookOpen,
  },
  {
    label: 'Notes',
    description: 'Vault-protected field notes',
    href: '/(tabs)/notes',
    icon: NotebookPen,
  },
  {
    label: 'Tools',
    description: 'Compass, weather, sensors, and checklists',
    href: '/(tabs)/tools',
    icon: Compass,
  },
  {
    label: 'Security',
    description: 'Vault, theme, and diagnostics settings',
    href: '/(tabs)/settings',
    icon: Lock,
  },
  {
    label: 'Settings',
    description: 'Preferences and system status',
    href: '/(tabs)/settings',
    icon: Settings,
  },
];

export function FunctionSearchButton() {
  const [open, setOpen] = React.useState(false);

  function openFunction(href: Href) {
    setOpen(false);
    router.push(href);
  }

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

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/60" onPress={() => setOpen(false)}>
          <View className="flex-1 justify-start px-4 pt-16">
            <Pressable
              className="border-border bg-card max-h-[78%] w-full gap-2 rounded-2xl border p-3"
              onPress={(event) => event.stopPropagation()}>
              <View className="flex-row items-center gap-2 px-1 pb-2">
                <Icon as={Search} className="text-muted-foreground size-4" />
                <Text className="font-semibold">Function search</Text>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View className="gap-1">
                  {FUNCTIONS.map((item) => (
                    <Pressable
                      key={item.label}
                      accessibilityRole="button"
                      onPress={() => openFunction(item.href)}
                      className="active:bg-accent flex-row items-center gap-3 rounded-xl p-3">
                      <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-full">
                        <Icon as={item.icon} className="text-primary size-5" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-semibold">{item.label}</Text>
                        <Text
                          variant="muted"
                          className="leading-5"
                          numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
