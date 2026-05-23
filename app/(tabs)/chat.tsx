import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SAFETY_COPY } from '@/constants/app';
import { AIService } from '@/services/ai/ai.service';
import type { AiMessage } from '@/types/ai';
import { Bot, Search, Send, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';

function MessageBubble({ message }: { message: AiMessage }) {
  const assistant = message.role === 'assistant';
  return (
    <View className={assistant ? 'items-start' : 'items-end'}>
      <Card
        className={
          assistant
            ? 'max-w-[92%] gap-2 rounded-lg'
            : 'bg-primary max-w-[92%] gap-2 rounded-lg border-transparent'
        }>
        <Text
          variant="small"
          className={assistant ? 'text-primary uppercase' : 'text-primary-foreground uppercase'}>
          {assistant ? 'Ark' : 'You'}
        </Text>
        <Text selectable className={assistant ? undefined : 'text-primary-foreground'}>
          {message.content}
        </Text>
        {message.citations.length ? (
          <View className="border-border mt-1 gap-1 border-t pt-2">
            <Text variant="small">Sources</Text>
            {message.citations.map((citation) => (
              <Text key={`${message.id}-${citation.sourceId}`} variant="muted">
                {citation.title}: {citation.snippet}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

export default function ChatScreen() {
  const [threadId, setThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [useRag, setUseRag] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    const id = await AIService.getLatestThread();
    if (id) {
      setThreadId(id);
      setMessages(await AIService.listMessages(id));
    }
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function send() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setContent('');
    try {
      const result = await AIService.sendMessage({ threadId, content: trimmed, useRag });
      setThreadId(result.threadId);
      setMessages((current) => [...current, ...result.messages]);
    } catch (sendError) {
      setContent(trimmed);
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  async function clearThread() {
    if (!threadId) return;
    await AIService.clearThread(threadId);
    setThreadId(undefined);
    setMessages([]);
  }

  function confirmClear() {
    if (!threadId) return;
    Alert.alert('Clear chat?', 'This removes the current local thread from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void clearThread() },
    ]);
  }

  const data = React.useMemo(() => [...messages].reverse(), [messages]);

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View className="border-border bg-background gap-3 border-b px-4 py-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="h1" className="text-3xl">
              Ask Ark
            </Text>
            <Text variant="muted">Local answers with offline source retrieval.</Text>
          </View>
          <Button
            size="icon"
            variant="ghost"
            disabled={!threadId || sending}
            onPress={confirmClear}>
            <Icon as={Trash2} className="size-5" />
          </Button>
        </View>
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            size="sm"
            variant={useRag ? 'default' : 'outline'}
            onPress={() => setUseRag((value) => !value)}>
            <Icon as={Search} className="size-4" />
            <Text>{useRag ? 'Sources on' : 'Sources off'}</Text>
          </Button>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 gap-3 p-4">
          <Skeleton className="h-24 w-[86%]" />
          <Skeleton className="ml-auto h-16 w-[72%]" />
          <Skeleton className="h-28 w-[92%]" />
          <Text variant="muted">Loading local thread...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <View className="bg-primary/15 size-14 items-center justify-center rounded-lg">
            <Icon as={Bot} className="text-primary size-7" />
          </View>
          <Text variant="large">No messages yet</Text>
          <Text variant="muted" className="text-center">
            Ask about downloaded guides, notes, or offline operating plans.
          </Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ gap: 12, padding: 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {sending ? (
        <View className="border-border flex-row items-center gap-2 border-t px-4 py-2">
          <ActivityIndicator />
          <Text variant="muted">Ark is checking local sources...</Text>
        </View>
      ) : null}

      {error ? (
        <View className="border-destructive/40 border-t px-4 py-2">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      ) : null}

      <View className="border-border bg-card gap-2 border-t p-3">
        <Text className="text-destructive text-xs">{SAFETY_COPY.ai}</Text>
        <View className="flex-row items-end gap-2">
          <Input
            className="max-h-32 min-h-12 flex-1"
            value={content}
            onChangeText={setContent}
            placeholder="Ask an offline question"
            multiline
          />
          <Button size="icon" onPress={send} disabled={sending || !content.trim()}>
            {sending ? <ActivityIndicator /> : <Icon as={Send} className="size-5" />}
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
