import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Arky } from '@/components/brand/ark-logo';
import { AIService, isAiRequestCancelledError } from '@/services/ai/ai.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import type { AiCitation, AiMessage } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import { router, useFocusEffect } from 'expo-router';
import {
  Bot,
  ChevronDown,
  ExternalLink,
  Search,
  Send,
  StopCircle,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
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
      <Text variant="muted" numberOfLines={2}>
        {citation.title}
        {location ? `, ${location}` : ''}
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
  modelDisabled,
  pickerEnabled,
  disabled,
  onOpen,
}: {
  installedModels: ContentPack[];
  activeModel: ContentPack | null;
  modelDisabled: boolean;
  pickerEnabled: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const canSelect = pickerEnabled;
  const label =
    activeModel?.title ??
    (modelDisabled || installedModels.length ? 'Source search only' : 'No model installed');

  if (!canSelect) {
    return (
      <View className="border-border bg-card min-h-12 flex-1 flex-row items-center gap-2 rounded-md border px-3 py-2">
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
      className="min-h-12 flex-1 justify-between px-3 py-2"
      variant="outline"
      disabled={disabled}
      onPress={onOpen}>
      <View className="min-w-0 flex-1 flex-row items-center gap-2 py-1">
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
  if (message.role === 'tool') {
    return (
      <View className="items-start">
        <Card className="border-primary/30 bg-muted/20 max-w-[92%] gap-2 rounded-lg">
          <View className="flex-row items-center gap-2">
            <Icon as={Search} className="text-primary size-4" />
            <Text variant="small" className="text-primary uppercase">
              Local tools
            </Text>
          </View>
          <Text variant="muted" selectable>
            {message.content}
          </Text>
          {message.citations.length ? (
            <Text variant="small" className="text-muted-foreground">
              {message.citations.length} local matches prepared for Arky.
            </Text>
          ) : null}
        </Card>
      </View>
    );
  }

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

function StreamingBubble({ content, onStop }: { content: string; onStop: () => void }) {
  return (
    <View className="px-3 pb-2">
      <Card className="gap-2 rounded-lg px-3 py-2">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" />
            <Text variant="small" className="text-primary uppercase">
              Arky
            </Text>
          </View>
          <Button size="sm" variant="outline" onPress={onStop}>
            <Icon as={StopCircle} className="size-4" />
            <Text>Stop</Text>
          </Button>
        </View>
        <Text selectable numberOfLines={4}>
          {content || 'Checking local sources...'}
        </Text>
      </Card>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [threadId, setThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [modelPickerEnabled, setModelPickerEnabled] = React.useState(true);
  const [modelDisabled, setModelDisabled] = React.useState(false);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [keyboardInset, setKeyboardInset] = React.useState(0);
  const sendRunIdRef = React.useRef(0);

  const refreshModels = React.useCallback(async () => {
    const [models, model, preferences] = await Promise.all([
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getPreferences(),
    ]);
    setInstalledModels(models);
    setActiveModel(model);
    setModelPickerEnabled(preferences.modelPickerEnabled);
    setModelDisabled(preferences.chatModelDisabled);
  }, []);

  async function load() {
    setLoading(true);
    const id = await AIService.getLatestThread();
    if (id) {
      setThreadId(id);
      setMessages(await AIService.listMessages(id));
    }
    await refreshModels();
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void refreshModels();
      const interval = setInterval(() => void refreshModels(), 2000);
      return () => clearInterval(interval);
    }, [refreshModels])
  );

  React.useEffect(() => {
    function updateKeyboardInset(event: KeyboardEvent) {
      const keyboardTop = event.endCoordinates.screenY;
      const overlap = Math.max(0, windowHeight - keyboardTop);
      setKeyboardInset(overlap);
      setKeyboardVisible(overlap > 0);
    }

    function clearKeyboardInset() {
      setKeyboardInset(0);
      setKeyboardVisible(false);
    }

    const willChange = Keyboard.addListener('keyboardWillChangeFrame', updateKeyboardInset);
    const didShow = Keyboard.addListener('keyboardDidShow', updateKeyboardInset);
    const didHide = Keyboard.addListener('keyboardDidHide', clearKeyboardInset);
    return () => {
      willChange.remove();
      didShow.remove();
      didHide.remove();
    };
  }, [windowHeight]);

  async function send() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    const runId = sendRunIdRef.current + 1;
    sendRunIdRef.current = runId;
    setSending(true);
    setStreamingText('');
    setError(null);
    setContent('');
    try {
      const result = await AIService.sendMessage(
        { threadId, content: trimmed, useRag: true },
        {
          onToken: (token) => {
            if (sendRunIdRef.current === runId) setStreamingText(token);
          },
        }
      );
      if (sendRunIdRef.current !== runId) return;
      setThreadId(result.threadId);
      setMessages((current) => [...current, ...result.messages]);
    } catch (sendError) {
      if (isAiRequestCancelledError(sendError)) return;
      setContent(trimmed);
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      if (sendRunIdRef.current === runId) {
        setStreamingText('');
        setSending(false);
      }
    }
  }

  async function clearThread() {
    if (!threadId) return;
    await AIService.clearThread(threadId);
    setThreadId(undefined);
    setMessages([]);
  }

  async function stopResponse() {
    sendRunIdRef.current += 1;
    setSending(false);
    setStreamingText('');
    await AIService.cancelActiveResponse();
  }

  async function selectModel(model: ContentPack) {
    await ModelManagerService.setSelectedModel(model.id);
    setActiveModel(model);
    setModelDisabled(false);
    await refreshModels();
    setModelMenuOpen(false);
  }

  async function disableModel() {
    await ModelManagerService.setChatModelDisabled(true);
    setActiveModel(null);
    setModelDisabled(true);
    await refreshModels();
    setModelMenuOpen(false);
  }

  function openModelMenu() {
    Keyboard.dismiss();
    setKeyboardVisible(false);
    setModelMenuOpen(true);
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
          modelDisabled={modelDisabled}
          pickerEnabled={modelPickerEnabled}
          disabled={sending}
          onOpen={openModelMenu}
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
        <View
          className={
            keyboardVisible
              ? 'flex-1 justify-start gap-2 p-4'
              : 'flex-1 items-center justify-center gap-4 p-6'
          }>
          {keyboardVisible ? null : <Arky pose="scholar" size={132} />}
          <Text variant={keyboardVisible ? 'large' : 'h3'}>Ask Arky</Text>
          {!keyboardVisible ? (
            <Text variant="muted" className="text-center">
              Ask about downloaded guides, notes, saved maps, cached alerts, or weather.
            </Text>
          ) : null}
        </View>
      ) : (
        <FlatList
          className="flex-1"
          inverted
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{
            gap: 12,
            padding: 16,
            paddingBottom: keyboardVisible ? 8 : 24,
          }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {sending ? (
        <StreamingBubble content={streamingText} onStop={() => void stopResponse()} />
      ) : null}

      {error ? (
        <View className="border-destructive/40 border-t px-4 py-2">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      ) : null}

      <View
        className="border-border bg-card border-t px-3 py-2"
        style={{
          paddingBottom: keyboardInset > 0 ? keyboardInset + 8 : Math.max(10, insets.bottom),
        }}>
        <View className="flex-row items-end gap-2">
          <Input
            className="max-h-28 min-h-11 flex-1 py-2"
            value={content}
            onChangeText={setContent}
            placeholder="Ask Arky a question"
            multiline
          />
          <Button size="icon" onPress={send} disabled={sending || !content.trim()}>
            {sending ? <ActivityIndicator /> : <Icon as={Send} className="size-5" />}
          </Button>
        </View>
      </View>

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
            <Button
              className="h-auto min-h-14 justify-start py-3"
              variant={!activeModel ? 'default' : 'outline'}
              onPress={() => void disableModel()}>
              <View className="min-w-0 flex-1 items-start gap-1">
                <Text numberOfLines={1}>Source search only</Text>
                <Text
                  variant="small"
                  className={!activeModel ? 'text-primary-foreground/80' : 'text-muted-foreground'}
                  numberOfLines={2}>
                  Retrieve local RAG sources without loading a chat model.
                </Text>
              </View>
            </Button>
            {installedModels.map((model) => (
              <Button
                key={model.id}
                className="h-auto min-h-14 justify-start py-3"
                variant={activeModel?.id === model.id ? 'default' : 'outline'}
                onPress={() => void selectModel(model)}>
                <View className="min-w-0 flex-1 items-start gap-1">
                  <Text numberOfLines={1}>{model.title}</Text>
                  <Text
                    variant="small"
                    className={
                      activeModel?.id === model.id
                        ? 'text-primary-foreground/80'
                        : 'text-muted-foreground'
                    }
                    numberOfLines={2}>
                    {model.description}
                  </Text>
                </View>
              </Button>
            ))}
            {!installedModels.length ? (
              <Text variant="muted" className="px-1 py-2">
                Download a chat model in Settings to enable offline model replies.
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
