import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AIService } from '@/services/ai/ai.service';
import type { AiThread } from '@/types/ai';
import { router, useFocusEffect } from 'expo-router';
import { Bot, MessageSquare, Plus } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

export default function ChatIndexScreen() {
  const [threads, setThreads] = React.useState<AiThread[]>([]);
  const [loading, setLoading] = React.useState(true);

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
    router.push(`/(tabs)/chat/${threadId}` as never);
  }

  function newThread() {
    router.push('/(tabs)/chat/new' as never);
  }

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-4 py-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="h3">Ask Arky</Text>
            <Text variant="muted">Separate chats keep context focused.</Text>
          </View>
          <Button size="icon" onPress={newThread}>
            <Icon as={Plus} className="size-5" />
          </Button>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator />
          <Text variant="muted">Loading chats...</Text>
        </View>
      ) : threads.length ? (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, padding: 16 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => openThread(item.id)}>
              <Card className="gap-2 rounded-lg">
                <View className="flex-row items-center gap-3">
                  <View className="bg-primary/12 size-10 items-center justify-center rounded-md">
                    <Icon as={MessageSquare} className="text-primary size-5" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1}>{item.title}</Text>
                    <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
                      {item.lastMessage ?? 'No messages yet'}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <View className="bg-primary/12 size-20 items-center justify-center rounded-full">
            <Icon as={Bot} className="text-primary size-9" />
          </View>
          <View className="items-center gap-2">
            <Text variant="h3">No chats yet</Text>
            <Text variant="muted" className="text-center">
              Start a focused chat for a trip, guide, document, or emergency question.
            </Text>
          </View>
          <Button onPress={newThread}>
            <Icon as={Plus} className="size-4" />
            <Text>New chat</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
