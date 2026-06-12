import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { AIService } from '@/services/ai/ai.service';
import type { AiThread } from '@/types/ai';
import { formatDistanceToNow } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { Bot, CircleX, Plus, Search, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

export default function ChatIndexScreen() {
  const [threads, setThreads] = React.useState<AiThread[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionThread, setActionThread] = React.useState<AiThread | null>(null);
  const [confirmDeleteThread, setConfirmDeleteThread] = React.useState<AiThread | null>(null);
  const [query, setQuery] = React.useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleThreads = React.useMemo(() => {
    if (!normalizedQuery) return threads;
    return threads.filter((thread) =>
      [thread.title, thread.lastMessage, `${thread.messageCount} messages`]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery, threads]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setThreads(await AIService.listThreads());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  function openThread(threadId: string) {
    router.push(`/chat/${threadId}` as never);
  }

  function newThread() {
    router.push('/chat/new' as never);
  }

  async function deleteThread(thread: AiThread) {
    await AIService.clearThread(thread.id);
    setConfirmDeleteThread(null);
    setActionThread(null);
    await load();
  }

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-4 py-3">
        <View className="flex-row items-center gap-3">
          <View className="border-border min-w-0 flex-1 flex-row items-center border-b px-1">
            <Icon as={Search} className="text-muted-foreground size-4" />
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search chats"
              returnKeyType="search"
              accessibilityLabel="Search chats"
              className="min-h-11 flex-1 border-0 bg-transparent px-3 py-2"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear chat search"
                className="active:bg-accent size-9 items-center justify-center rounded-md"
                onPress={() => setQuery('')}>
                <Icon as={CircleX} className="text-muted-foreground size-4" />
              </Pressable>
            ) : null}
          </View>
          <Button size="sm" variant="secondary" onPress={newThread}>
            <Icon as={Plus} className="size-4" />
            <Text>New</Text>
          </Button>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator />
          <Text variant="muted">Loading chats...</Text>
        </View>
      ) : visibleThreads.length ? (
        <FlatList
          data={visibleThreads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openThread(item.id)}
              onLongPress={() => setActionThread(item)}
              delayLongPress={220}
              className="border-border active:bg-muted/40 border-b py-4">
              <View className="min-w-0 gap-1">
                <View className="flex-row items-start justify-between gap-3">
                  <Text className="min-w-0 flex-1 font-semibold" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="small" className="text-muted-foreground shrink-0">
                    {formatDistanceToNow(item.updatedAt, { addSuffix: true })}
                  </Text>
                </View>
                <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
                  {item.lastMessage ?? 'No messages yet'}
                </Text>
                <Text variant="small" className="text-muted-foreground">
                  {item.messageCount} {item.messageCount === 1 ? 'message' : 'messages'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <View className="bg-primary/12 size-20 items-center justify-center rounded-full">
            <Icon as={Bot} className="text-primary size-9" />
          </View>
          <View className="items-center gap-2">
            <Text variant="h3">{normalizedQuery ? 'No matching chats' : 'No chats yet'}</Text>
            <Text variant="muted" className="text-center">
              {normalizedQuery
                ? 'Try a title, answer text, or another search term.'
                : 'Start a focused chat for a trip, guide, document, or emergency question.'}
            </Text>
          </View>
          {!normalizedQuery ? (
            <Button onPress={newThread}>
              <Icon as={Plus} className="size-4" />
              <Text>New chat</Text>
            </Button>
          ) : null}
        </View>
      )}

      <ArkBottomSheet visible={!!actionThread} onDismiss={() => setActionThread(null)}>
        <Button
          variant="ghost"
          className="h-10 justify-start px-2"
          onPress={() => {
            setConfirmDeleteThread(actionThread);
            setActionThread(null);
          }}>
          <Icon as={Trash2} className="text-destructive size-4" />
          <Text className="text-destructive">Delete</Text>
        </Button>
      </ArkBottomSheet>

      <ConfirmModal
        visible={!!confirmDeleteThread}
        title="Delete chat?"
        description="This removes this local chat and its messages from this device."
        confirmVariant="destructive"
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteThread(null)}
        onConfirm={() => {
          if (confirmDeleteThread) void deleteThread(confirmDeleteThread);
        }}
      />
    </View>
  );
}
