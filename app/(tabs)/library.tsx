import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ContentPackService } from '@/services/content/content-pack.service';
import type { ContentCategory, ContentPack } from '@/types/content';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

const filters: Array<ContentCategory | 'All'> = [
  'All',
  'Survival',
  'Medical',
  'Maps',
  'Wiki',
  'RSS',
  'AI Models',
  'Personal Documents',
];

export default function LibraryScreen() {
  const [packs, setPacks] = React.useState<ContentPack[]>([]);
  const [filter, setFilter] = React.useState<(typeof filters)[number]>('All');

  async function load() {
    setPacks(await ContentPackService.listPacks());
  }

  React.useEffect(() => {
    load();
  }, []);

  const visible = filter === 'All' ? packs : packs.filter((pack) => pack.category === filter);

  return (
    <Screen>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}>
        {filters.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? 'default' : 'outline'}
            onPress={() => setFilter(item)}>
            <Text>{item}</Text>
          </Button>
        ))}
      </ScrollView>
      {visible.map((pack) => (
        <Card key={pack.id} className="gap-2">
          <View className="flex-row justify-between gap-3">
            <Text variant="large" className="flex-1">
              {pack.title}
            </Text>
            <Text className="text-primary">{Math.round(pack.progress * 100)}%</Text>
          </View>
          <Text variant="muted">{pack.description}</Text>
          <Text variant="muted">
            {pack.category} · {pack.format} · {pack.estimatedSize}
          </Text>
          {pack.disclaimer ? (
            <Text className="text-destructive text-sm">{pack.disclaimer}</Text>
          ) : null}
          <Button
            variant={pack.installed ? 'secondary' : 'default'}
            onPress={async () => {
              await ContentPackService.installMockPack(pack.id, pack.title);
              await load();
            }}>
            <Text>{pack.installed ? 'Installed' : 'Mock install'}</Text>
          </Button>
        </Card>
      ))}
    </Screen>
  );
}
