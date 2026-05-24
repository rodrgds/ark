import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { RssService } from '@/services/rss/rss.service';
import { Stack, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { ExternalLink, Newspaper } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';

type NewsItem = Awaited<ReturnType<typeof RssService.getItem>>;

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = React.useState<NewsItem>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    void (async () => {
      const next = await RssService.getItem(id);
      setItem(next);
      if (next && !next.read_at) await RssService.markItemRead(next.id, true);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <ActivityIndicator />
      </View>
    );
  }

  if (!item) {
    return (
      <Screen>
        <Card>
          <Text variant="muted">Cached article not found.</Text>
        </Card>
      </Screen>
    );
  }

  const body = item.content || item.summary || 'This feed item did not include article text.';

  return (
    <Screen contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: 'News' }} />
      <View className="gap-2">
        <Text variant="h1">{item.title}</Text>
        <Text variant="muted">
          {item.feed_title}
          {item.published_at ? ` · ${format(item.published_at, 'PPp')}` : ''}
        </Text>
      </View>

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon as={Newspaper} className="text-primary size-5" />
          <Text variant="large">Offline copy</Text>
        </View>
        <Text selectable className="leading-6">
          {body}
        </Text>
      </Card>

      {item.url ? (
        <Card className="gap-3">
          <Text variant="large">Source</Text>
          <Text selectable variant="muted">
            {item.url}
          </Text>
          <Button variant="outline" onPress={() => void Linking.openURL(item.url!)}>
            <Icon as={ExternalLink} className="size-4" />
            <Text>Open original</Text>
          </Button>
        </Card>
      ) : null}
    </Screen>
  );
}
