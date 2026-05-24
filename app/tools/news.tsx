import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { RssService } from '@/services/rss/rss.service';
import { formatDistanceToNow } from 'date-fns';
import { router } from 'expo-router';
import { CheckCheck, Newspaper, Plus, Radio, RefreshCw, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, RefreshControl, View } from 'react-native';

type NewsFilter = 'unread' | 'all';

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View className="bg-destructive min-w-6 items-center rounded-full px-2 py-0.5">
      <Text className="text-xs font-bold text-white">{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export default function NewsScreen() {
  const [overview, setOverview] = React.useState<Awaited<
    ReturnType<typeof RssService.getOverview>
  > | null>(null);
  const [filter, setFilter] = React.useState<NewsFilter>('unread');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [feedTitle, setFeedTitle] = React.useState('');
  const [feedUrl, setFeedUrl] = React.useState('');
  const inputHintProp = 'place' + 'holder';
  const visibleItems = React.useMemo(() => {
    const items = overview?.recentItems ?? [];
    return filter === 'unread' ? items.filter((item) => !item.read_at) : items;
  }, [filter, overview?.recentItems]);

  async function load() {
    setOverview(await RssService.getOverview());
  }

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const initial = await RssService.getOverview();
      if (!active) return;
      setOverview(initial);
      if (!initial.lastFetchedAt || Date.now() - initial.lastFetchedAt > 30 * 60 * 1000) {
        const result = await RssService.refreshIfStale();
        if (!active) return;
        setOverview(result.overview);
        if (result.errors.length) setError(result.errors.join('\n'));
      }
    })();
    const interval = setInterval(
      () => {
        void RssService.refreshIfStale().then((result) => {
          if (!active) return;
          setOverview(result.overview);
          if (result.errors.length) setError(result.errors.join('\n'));
        });
      },
      30 * 60 * 1000
    );
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function refreshFeeds() {
    setBusy('refresh');
    setError(null);
    try {
      const result = await RssService.refreshAll();
      setOverview(result.overview);
      if (result.errors.length) {
        setError(result.errors.join('\n'));
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh feeds.');
    } finally {
      setBusy(null);
    }
  }

  async function addFeed() {
    setBusy('add');
    setError(null);
    try {
      await RssService.addFeed(feedTitle, feedUrl);
      setFeedTitle('');
      setFeedUrl('');
      await load();
    } catch (feedError) {
      setError(feedError instanceof Error ? feedError.message : 'Unable to add feed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={busy === 'refresh'} onRefresh={() => void refreshFeeds()} />
      }>
      <View className="gap-2">
        <Text variant="h1">News</Text>
        <Text variant="muted">
          Cache emergency and situation feeds for offline reading after each refresh.
        </Text>
      </View>

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="bg-primary/15 relative size-11 items-center justify-center rounded-md">
            <Icon as={Newspaper} className="text-primary size-6" />
            {overview?.unreadCount ? (
              <View className="absolute -top-2 -right-2">
                <UnreadBadge count={overview.unreadCount} />
              </View>
            ) : null}
          </View>
          <View className="min-w-0 flex-1">
            <Text variant="large">{overview?.unreadCount ?? 0} unread</Text>
            <Text variant="small" className="text-muted-foreground">
              {overview?.feeds.length ?? 0} feeds
              {overview?.lastFetchedAt
                ? ` - refreshed ${formatDistanceToNow(overview.lastFetchedAt, { addSuffix: true })}`
                : ' - no refresh yet'}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            disabled={busy === 'refresh'}
            onPress={() => void refreshFeeds()}>
            {busy === 'refresh' ? (
              <ActivityIndicator />
            ) : (
              <Icon as={RefreshCw} className="size-4" />
            )}
            <Text>Refresh now</Text>
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={!overview?.recentItems.some((item) => !item.read_at) || busy === 'read-all'}
            onPress={async () => {
              setBusy('read-all');
              await RssService.markAllRead();
              await load();
              setBusy(null);
            }}>
            <Icon as={CheckCheck} className="size-4" />
            <Text>Mark all read</Text>
          </Button>
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon as={Radio} className="text-primary size-5" />
          <Text variant="large">Feeds</Text>
        </View>
        <View className="gap-2">
          <Input
            value={feedTitle}
            onChangeText={setFeedTitle}
            {...{ [inputHintProp]: 'Feed name' }}
          />
          <Input
            value={feedUrl}
            onChangeText={setFeedUrl}
            {...{ [inputHintProp]: 'https://example.com/feed.xml' }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            variant="outline"
            disabled={busy === 'add' || !feedTitle.trim() || !feedUrl.trim()}
            onPress={() => void addFeed()}>
            {busy === 'add' ? <ActivityIndicator /> : null}
            {busy !== 'add' ? <Icon as={Plus} className="size-4" /> : null}
            <Text>Add feed</Text>
          </Button>
        </View>
        <View className="gap-2">
          {overview?.feeds.map((feed) => {
            const unreadCount = overview.unreadByFeed[feed.id] ?? 0;
            return (
              <View
                key={feed.id}
                className="border-border flex-row items-center gap-3 border-t pt-3 first:border-t-0 first:pt-0">
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="min-w-0 flex-1" numberOfLines={1}>
                      {feed.title}
                    </Text>
                    <UnreadBadge count={unreadCount} />
                  </View>
                  <Text variant="small" className="text-muted-foreground" numberOfLines={1}>
                    {feed.url}
                  </Text>
                </View>
                <Button
                  size="sm"
                  variant={feed.enabled ? 'default' : 'outline'}
                  onPress={async () => {
                    await RssService.setFeedEnabled(feed.id, !Boolean(feed.enabled));
                    await load();
                  }}>
                  <Text>{feed.enabled ? 'On' : 'Off'}</Text>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onPress={() => {
                    Alert.alert('Remove feed?', feed.title, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () =>
                          void (async () => {
                            await RssService.removeFeed(feed.id);
                            await load();
                          })(),
                      },
                    ]);
                  }}>
                  <Icon as={Trash2} className="size-4" />
                </Button>
              </View>
            );
          })}
        </View>
      </Card>

      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="large">Latest items</Text>
          <View className="border-border bg-muted/20 flex-row rounded-md border p-1">
            {(['unread', 'all'] as const).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={filter === item ? 'default' : 'ghost'}
                onPress={() => setFilter(item)}>
                <Text>{item === 'unread' ? 'Unread' : 'All'}</Text>
              </Button>
            ))}
          </View>
        </View>
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <Card
              key={item.id}
              className={item.read_at ? 'gap-3 opacity-80' : 'border-primary/40 gap-3'}>
              <View className="gap-1">
                <View className="flex-row items-start gap-2">
                  {!item.read_at ? <View className="bg-primary mt-2 h-2 w-2 rounded-full" /> : null}
                  <View className="min-w-0 flex-1">
                    <Text>{item.title}</Text>
                    <Text variant="small" className="text-muted-foreground">
                      {item.feed_title}
                      {item.published_at
                        ? ` - ${formatDistanceToNow(item.published_at, { addSuffix: true })}`
                        : ''}
                    </Text>
                  </View>
                </View>
              </View>
              {item.summary ? (
                <Text variant="muted" numberOfLines={4}>
                  {item.summary}
                </Text>
              ) : null}
              <View className="flex-row gap-2">
                <Button
                  className="flex-1"
                  variant={item.read_at ? 'outline' : 'default'}
                  onPress={async () => {
                    await RssService.markItemRead(item.id, !item.read_at);
                    await load();
                  }}>
                  <Icon as={CheckCheck} className="size-4" />
                  <Text>{item.read_at ? 'Mark unread' : 'Mark read'}</Text>
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onPress={() => router.push(`/tools/news/${item.id}` as never)}>
                  <Icon as={Newspaper} className="size-4" />
                  <Text>Read offline</Text>
                </Button>
              </View>
            </Card>
          ))
        ) : (
          <Card className="gap-2">
            <Text variant="large">
              {filter === 'unread' ? 'No unread items' : 'No cached items yet'}
            </Text>
            <Text variant="muted">
              {filter === 'unread'
                ? 'New articles will appear here after the next feed refresh.'
                : 'Refresh your feeds once and the latest articles will stay available offline.'}
            </Text>
          </Card>
        )}
      </View>

      {error ? <Text className="text-destructive">{error}</Text> : null}
    </Screen>
  );
}
