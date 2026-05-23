import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Arky } from '@/components/brand/ark-logo';
import { SAFETY_COPY } from '@/constants/app';
import { AIService } from '@/services/ai/ai.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import type { AiCitation, AiMessage } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import { router } from 'expo-router';
import { Bot, ChevronDown, ExternalLink, Send, StopCircle, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  View,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CitationItem({ citation }: { citation: AiCitation }) {
  const location = [
    citation.sectionTitle,
    typeof citation.page === 'number' ? `page ${citation.page}` : null,
  ]
    .filter(Boolean)
    .join(' - ');
  const actionLabel =
    typeof citation.page === 'number'
      ? `Open page ${citation.page}`
      : citation.sectionTitle
        ? 'Open chapter'
        : 'Open source';

  return (
    <View className="gap-1">
      <Text variant="muted">
        {citation.title}
        {location ? `, ${location}` : ''}: {citation.snippet}
      </Text>
      {citation.targetHref ? (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onPress={() => router.push(citation.targetHref as never)}>
          <Icon as={ExternalLink} className="size-4" />
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}

function ModelPill({
  installedModels,
  activeModel,
  pickerEnabled,
  disabled,
  onOpen,
}: {
  installedModels: ContentPack[];
  activeModel: ContentPack | null;
  pickerEnabled: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const canSelect = pickerEnabled && installedModels.length > 1;
  const label = activeModel?.title ?? 'No AI model downloaded';

  if (!canSelect) {
    return (
      <View className="border-border bg-card min-h-12 flex-1 flex-row items-center gap-2 rounded-md border px-3">
        <Icon as={Bot} className="text-primary size-4" />
        <View className="min-w-0 flex-1">
          <Text variant="small" className="text-muted-foreground uppercase">
            AI model
          </Text>
          <Text numberOfLines={1}>{label}</Text>
        </View>
      </View>
    );
  }

  return (
    <Button
      className="min-h-12 flex-1 justify-between px-3"
      variant="outline"
      disabled={disabled}
      onPress={onOpen}>
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Icon as={Bot} className="text-primary size-4" />
        <View className="min-w-0 flex-1 items-start">
          <Text variant="small" className="text-muted-foreground uppercase">
            AI model
          </Text>
          <Text numberOfLines={1}>{label}</Text>
        </View>
      </View>
      <Icon as={ChevronDown} className="size-4" />
    </Button>
  );
}

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
          {assistant ? 'Arky' : 'You'}
        </Text>
        <Text selectable className={assistant ? undefined : 'text-primary-foreground'}>
          {message.content}
        </Text>
        {message.citations.length ? (
          <View className="border-border mt-1 gap-1 border-t pt-2">
            <Text variant="small">Sources</Text>
            {message.citations.map((citation) => (
              <CitationItem key={`${message.id}-${citation.sourceId}`} citation={citation} />
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <View className="items-start px-4 pb-2">
      <View className="flex-row items-end gap-2">
        <Arky pose="thinking" size={44} className="mb-1" />
        <Card className="max-w-[85%] gap-2 rounded-lg">
          <Text variant="small" className="text-primary uppercase">
            Arky
          </Text>
          <Text selectable>{content || 'Thinking through local sources...'}</Text>
        </Card>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [threadId, setThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [modelPickerEnabled, setModelPickerEnabled] = React.useState(true);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const keyboard = useAnimatedKeyboard();
  const composerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboard.height.value - insets.bottom + 14) }],
  }));

  async function load() {
    setLoading(true);
    const id = await AIService.getLatestThread();
    if (id) {
      setThreadId(id);
      setMessages(await AIService.listMessages(id));
    }
    const [models, model, preferences] = await Promise.all([
      ModelManagerService.listInstalledModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getPreferences(),
    ]);
    setInstalledModels(models);
    setActiveModel(model);
    setModelPickerEnabled(preferences.modelPickerEnabled);
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function send() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setStreamingText('');
    setError(null);
    setContent('');
    try {
      const result = await AIService.sendMessage(
        { threadId, content: trimmed, useRag: true },
        { onToken: setStreamingText }
      );
      setThreadId(result.threadId);
      setMessages((current) => [...current, ...result.messages]);
    } catch (sendError) {
      setContent(trimmed);
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setStreamingText('');
      setSending(false);
    }
  }

  async function clearThread() {
    if (!threadId) return;
    await AIService.clearThread(threadId);
    setThreadId(undefined);
    setMessages([]);
  }

  async function stopResponse() {
    await AIService.cancelActiveResponse();
  }

  async function selectModel(model: ContentPack) {
    await ModelManagerService.setSelectedModel(model.id);
    setActiveModel(model);
    setModelMenuOpen(false);
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
    <View className="bg-background flex-1">
      <View className="border-border bg-background flex-row items-center gap-2 border-b px-4 py-3">
        <ModelPill
          installedModels={installedModels}
          activeModel={activeModel}
          pickerEnabled={modelPickerEnabled}
          disabled={sending}
          onOpen={() => setModelMenuOpen(true)}
        />
        <Button size="icon" variant="ghost" disabled={!threadId || sending} onPress={confirmClear}>
          <Icon as={Trash2} className="size-5" />
        </Button>
      </View>

      {loading ? (
        <View className="flex-1 gap-3 p-4">
          <Skeleton className="h-24 w-[86%]" />
          <Skeleton className="ml-auto h-16 w-[72%]" />
          <Skeleton className="h-28 w-[92%]" />
          <Text variant="muted">Loading local thread...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Arky pose="scholar" size={160} />
          <Text variant="h3">Ask Arky</Text>
          <Text variant="muted" className="text-center">
            Ask about downloaded guides, notes, saved maps, cached alerts, or weather.
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

      {sending ? <StreamingBubble content={streamingText} /> : null}

      {sending ? (
        <View className="border-border flex-row items-center gap-3 border-t px-4 py-2">
          <ActivityIndicator />
          <Text variant="muted" className="min-w-0 flex-1">
            Arky is checking local sources...
          </Text>
          <Button size="sm" variant="outline" onPress={() => void stopResponse()}>
            <Icon as={StopCircle} className="size-4" />
            <Text>Stop</Text>
          </Button>
        </View>
      ) : null}

      {error ? (
        <View className="border-destructive/40 border-t px-4 py-2">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      ) : null}

      <Animated.View
        className="border-border bg-card gap-2 border-t p-3"
        style={composerStyle}>
        <Text className="text-destructive text-xs">{SAFETY_COPY.ai}</Text>
        <View className="flex-row items-end gap-2">
          <Input
            className="max-h-32 min-h-12 flex-1"
            value={content}
            onChangeText={setContent}
            placeholder="Ask Arky a question"
            multiline
          />
          <Button size="icon" onPress={send} disabled={sending || !content.trim()}>
            {sending ? <ActivityIndicator /> : <Icon as={Send} className="size-5" />}
          </Button>
        </View>
      </Animated.View>

      <Modal
        visible={modelMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModelMenuOpen(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/60 p-4"
          onPress={() => setModelMenuOpen(false)}>
          <Pressable className="bg-card border-border gap-2 rounded-lg border p-3">
            <Text variant="large">Choose AI model</Text>
            {installedModels.map((model) => (
              <Button
                key={model.id}
                className="justify-start"
                variant={activeModel?.id === model.id ? 'default' : 'outline'}
                onPress={() => void selectModel(model)}>
                <Text numberOfLines={1}>{model.title}</Text>
              </Button>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
