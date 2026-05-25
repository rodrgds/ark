import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MarkdownText } from '@/components/ui/markdown-text';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Arky } from '@/components/brand/ark-logo';
import { AIService, isAiRequestCancelledError } from '@/services/ai/ai.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import type { AiCitation, AiMessage, AiProgressEvent } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import { router, useFocusEffect } from 'expo-router';
import {
  Bot,
  ChevronDown,
  Check,
  ExternalLink,
  Info,
  Search,
  Send,
  StopCircle,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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

function ThinkingPanel({
  reasoning,
  defaultOpen = false,
}: {
  reasoning?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (!reasoning?.trim()) return null;

  return (
    <View className="border-border rounded-md border">
      <Button
        variant="ghost"
        className="h-10 justify-between px-3"
        onPress={() => setOpen((current) => !current)}>
        <Text variant="small" className="text-muted-foreground uppercase">
          Thinking
        </Text>
        <Icon as={ChevronDown} className={open ? 'size-4 rotate-180' : 'size-4'} />
      </Button>
      {open ? (
        <View className="border-border border-t px-3 py-2">
          <Text variant="small" className="text-muted-foreground leading-5" selectable>
            {reasoning}
          </Text>
        </View>
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

function ModelChoice({
  title,
  description,
  active,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  active: boolean;
  icon: typeof Bot;
  onPress: () => void;
}) {
  return (
    <Button
      className="h-auto min-h-14 justify-start py-3"
      variant={active ? 'default' : 'outline'}
      onPress={onPress}>
      <Icon as={icon} className="size-4" />
      <View className="min-w-0 flex-1 items-start gap-1">
        <Text numberOfLines={1}>{title}</Text>
        <Text
          variant="small"
          className={active ? 'text-primary-foreground/80' : 'text-muted-foreground'}
          numberOfLines={2}>
          {description}
        </Text>
      </View>
      {active ? <Icon as={Check} className="size-4" /> : null}
    </Button>
  );
}

function MessageBubble({ message }: { message: AiMessage }) {
  if (message.role === 'tool') {
    return null;
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
        {assistant ? (
          <MarkdownText>{message.content}</MarkdownText>
        ) : (
          <Text selectable className="text-primary-foreground">
            {message.content}
          </Text>
        )}
        {assistant ? <ThinkingPanel reasoning={message.reasoning} /> : null}
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

function StreamingBubble({
  content,
  reasoning,
  progress,
  onStop,
}: {
  content: string;
  reasoning: string;
  progress: AiProgressEvent | null;
  onStop: () => void;
}) {
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
        {content ? (
          <MarkdownText>{content}</MarkdownText>
        ) : (
          <Text>{progress?.label || 'Checking local sources...'}</Text>
        )}
        <ThinkingPanel reasoning={reasoning} defaultOpen={!content} />
        {!content && progress?.label ? (
          <Text variant="small" className="text-muted-foreground">
            Preparing the safest source-grounded answer available offline.
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [threadId, setThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [installedEmbeddingModels, setInstalledEmbeddingModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [modelPickerEnabled, setModelPickerEnabled] = React.useState(true);
  const [modelDisabled, setModelDisabled] = React.useState(false);
  const [activeEmbeddingModel, setActiveEmbeddingModel] = React.useState<ContentPack | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [modelInfoOpen, setModelInfoOpen] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState('');
  const [streamingReasoning, setStreamingReasoning] = React.useState('');
  const [progressEvent, setProgressEvent] = React.useState<AiProgressEvent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const sendRunIdRef = React.useRef(0);

  const refreshModels = React.useCallback(async () => {
    const [models, embeddingModels, model, embeddingModel, preferences] = await Promise.all([
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.listInstalledEmbeddingModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getActiveEmbeddingModel(),
      ModelManagerService.getPreferences(),
    ]);
    setInstalledModels(models);
    setInstalledEmbeddingModels(embeddingModels);
    setActiveModel(model);
    setActiveEmbeddingModel(embeddingModel);
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
    const didShow = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const didHide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      didShow.remove();
      didHide.remove();
    };
  }, []);

  async function send() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    const runId = sendRunIdRef.current + 1;
    sendRunIdRef.current = runId;
    setSending(true);
    setStreamingText('');
    setStreamingReasoning('');
    setProgressEvent(null);
    setError(null);
    setContent('');
    try {
      const result = await AIService.sendMessage(
        { threadId, content: trimmed, useRag: true },
        {
          onProgress: (progress) => {
            if (sendRunIdRef.current === runId) setProgressEvent(progress);
          },
          onToken: (token) => {
            if (sendRunIdRef.current === runId) {
              setStreamingText(token);
            }
          },
          onReasoning: (reasoning) => {
            if (sendRunIdRef.current === runId) {
              setStreamingReasoning(reasoning);
            }
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
        setStreamingReasoning('');
        setProgressEvent(null);
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
    setStreamingReasoning('');
    setProgressEvent(null);
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

  async function selectEmbeddingModel(model: ContentPack | null) {
    await ModelManagerService.setSelectedEmbeddingModel(model?.id ?? null);
    setActiveEmbeddingModel(model);
    await refreshModels();
  }

  function openModelMenu() {
    Keyboard.dismiss();
    setKeyboardVisible(false);
    setModelMenuOpen(true);
  }

  function confirmClear() {
    if (!threadId) return;
    Keyboard.dismiss();
    setKeyboardVisible(false);
    setClearConfirmOpen(true);
  }

  const data = React.useMemo(
    () => messages.filter((message) => message.role !== 'tool').reverse(),
    [messages]
  );
  const canChooseModel = modelPickerEnabled && installedModels.length > 1;

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior="padding"
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={0}>
      <View className="border-border bg-background flex-row items-center gap-2 border-b px-4 py-3">
        {canChooseModel ? (
          <View className="flex-1 gap-2">
            <ModelPill
              installedModels={installedModels}
              activeModel={activeModel}
              modelDisabled={modelDisabled}
              pickerEnabled={modelPickerEnabled}
              disabled={sending}
              onOpen={openModelMenu}
            />
          </View>
        ) : (
          <View className="min-h-12 flex-1 justify-center">
            <Text variant="large">Ask Arky</Text>
            <Text variant="small" className="text-muted-foreground">
              {activeModel ? 'Offline answers with local sources' : 'Offline source search'}
            </Text>
          </View>
        )}
        <Button size="icon" variant="ghost" onPress={() => setModelInfoOpen(true)}>
          <Icon as={Info} className="size-5" />
        </Button>
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
        <StreamingBubble
          content={streamingText}
          reasoning={streamingReasoning}
          progress={progressEvent}
          onStop={() => void stopResponse()}
        />
      ) : null}

      {error ? (
        <View className="border-destructive/40 border-t px-4 py-2">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      ) : null}

      <View
        className="border-border bg-card border-t px-3 py-2"
        style={{
          paddingBottom: Math.max(10, insets.bottom),
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

      <ConfirmModal
        visible={clearConfirmOpen}
        title="Clear chat?"
        description="This removes the current local thread from this device."
        confirmLabel="Clear"
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          setClearConfirmOpen(false);
          void clearThread();
        }}
      />

      <ArkBottomSheet
        visible={modelInfoOpen}
        title="AI in use"
        description="Choose the local answer model and source-search model for this chat."
        onDismiss={() => setModelInfoOpen(false)}
        scrollable
        maxDynamicContentSize={620}>
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={Bot} className="text-primary size-5" />
            <Text variant="large">Answer model</Text>
          </View>
          <ModelChoice
            title="Source search only"
            description="Retrieve local sources without loading an answer model."
            active={!activeModel}
            icon={Search}
            onPress={() => void disableModel()}
          />
          {installedModels.map((model) => (
            <ModelChoice
              key={model.id}
              title={model.title}
              description={model.description ?? 'Installed local answer model.'}
              active={activeModel?.id === model.id}
              icon={Bot}
              onPress={() => void selectModel(model)}
            />
          ))}
          {!installedModels.length ? (
            <Text variant="muted" className="px-1 py-2">
              Download an answer model in Settings to enable offline replies.
            </Text>
          ) : null}
        </View>

        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={Search} className="text-primary size-5" />
            <Text variant="large">Source search</Text>
          </View>
          <ModelChoice
            title="Ark hash fallback"
            description="Always available. Lower quality than a downloaded embedding model, but fully local."
            active={!activeEmbeddingModel}
            icon={Search}
            onPress={() => void selectEmbeddingModel(null)}
          />
          {installedEmbeddingModels.map((model) => (
            <ModelChoice
              key={model.id}
              title={model.title}
              description={model.description ?? 'Installed local embedding model.'}
              active={activeEmbeddingModel?.id === model.id}
              icon={Search}
              onPress={() => void selectEmbeddingModel(model)}
            />
          ))}
        </View>
      </ArkBottomSheet>

      <ArkBottomSheet
        visible={modelMenuOpen}
        title="Choose answer model"
        onDismiss={() => setModelMenuOpen(false)}
        scrollable
        maxDynamicContentSize={520}>
        <ModelChoice
          title="Source search only"
          description="Retrieve local sources without loading an answer model."
          active={!activeModel}
          icon={Search}
          onPress={() => void disableModel()}
        />
        {installedModels.map((model) => (
          <ModelChoice
            key={model.id}
            title={model.title}
            description={model.description ?? 'Installed local answer model.'}
            active={activeModel?.id === model.id}
            icon={Bot}
            onPress={() => void selectModel(model)}
          />
        ))}
        {!installedModels.length ? (
          <Text variant="muted" className="px-1 py-2">
            Download an answer model in Settings to enable offline replies.
          </Text>
        ) : null}
      </ArkBottomSheet>
    </KeyboardAvoidingView>
  );
}
