import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ChatInput, type ChatInputAttachment } from '@/components/chat/chat-input';
import {
  ChatMessage,
  StreamingChatMessage,
  buildChatListItems,
  type ChatListItem,
} from '@/components/chat/chat-message';
import {
  ATTACHMENT_CONTEXT_CHARS,
  describeDocumentAttachment,
  describeLibraryPack,
  inferImageMimeType,
  loadMessagePage,
  messageAttachmentsFromAttachments,
  promptForAttachments,
} from '@/components/chat/chat-thread-utils';
import { useAppHeaderActions } from '@/components/layout/app-header-actions';
import { BATTERY_POLL_INTERVALS_MS } from '@/constants/battery';
import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import { useArkTextToSpeech } from '@/hooks/use-ark-text-to-speech';
import { AIService, isAiRequestCancelledError } from '@/services/ai/ai.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';
import { isVisionCapableChatModel } from '@/services/ai/vision-models';
import { ContentPackService } from '@/services/content/content-pack.service';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { ImportService } from '@/services/files/import.service';
import { useAuthStore } from '@/stores/auth-store';
import type { AiAttachment, AiMessage, AiProgressEvent } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import type { ArkDocument, Note } from '@/types/db';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  BookOpen,
  Bot,
  Camera,
  ChevronLeft,
  Check,
  FileText,
  Image as ImageIcon,
  NotebookPen,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MESSAGE_LIST_BOTTOM_PADDING = 168;
const MAX_CHAT_ATTACHMENTS = 6;

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
  icon: LucideIcon;
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

function ContextChoice({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Button className="h-auto min-h-14 justify-start py-3" variant="outline" onPress={onPress}>
      <Icon as={icon} className="size-4" />
      <View className="min-w-0 flex-1 items-start gap-1">
        <Text numberOfLines={1}>{title}</Text>
        <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
          {description}
        </Text>
      </View>
    </Button>
  );
}

function appendProgressEvent(events: AiProgressEvent[], next: AiProgressEvent) {
  const last = events[events.length - 1];
  if (last?.stage === next.stage && last.label === next.label) return events;
  return [...events, next].slice(-8);
}


export default function ChatScreen() {
  const { threadId: routeThreadId } = useLocalSearchParams<{ threadId?: string }>();
  const insets = useSafeAreaInsets();
  const reduceModeEnabled = useBatteryReduceMode();
  const speechPlayback = useArkTextToSpeech();
  const vaultUnlocked = useAuthStore((state) => state.unlocked);
  const initialThreadId = routeThreadId && routeThreadId !== 'new' ? routeThreadId : undefined;
  const [threadId, setThreadId] = React.useState<string | undefined>(initialThreadId);
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [activeVisionProjector, setActiveVisionProjector] = React.useState<ContentPack | null>(
    null
  );
  const [modelDisabled, setModelDisabled] = React.useState(false);
  const [modelInfoOpen, setModelInfoOpen] = React.useState(false);
  const [contextSheetOpen, setContextSheetOpen] = React.useState(false);
  const [librarySheetOpen, setLibrarySheetOpen] = React.useState(false);
  const [notesSheetOpen, setNotesSheetOpen] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = React.useState<AiMessage | null>(null);
  const [attachments, setAttachments] = React.useState<ChatInputAttachment[]>([]);
  const [libraryPacks, setLibraryPacks] = React.useState<ContentPack[]>([]);
  const [documents, setDocuments] = React.useState<ArkDocument[]>([]);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [contextLoading, setContextLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState('');
  const [streamingReasoning, setStreamingReasoning] = React.useState('');
  const [progressEvents, setProgressEvents] = React.useState<AiProgressEvent[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = React.useState<AiMessage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [olderLoading, setOlderLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = React.useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const sendRunIdRef = React.useRef(0);
  const modelChoiceDirtyRef = React.useRef(false);
  const flatListRef = React.useRef<FlatList>(null);
  const hasOlderMessagesRef = React.useRef(false);

  const scrollToBottom = React.useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 60);
  }, []);

  const loadOlderMessages = React.useCallback(async () => {
    if (!threadId || olderLoading || !hasOlderMessagesRef.current || !messages.length) return;
    setOlderLoading(true);
    try {
      const page = await loadMessagePage(threadId, messages[0].createdAt);
      setMessages((current) => [...page.messages, ...current]);
      hasOlderMessagesRef.current = page.hasOlder;
    } finally {
      setOlderLoading(false);
    }
  }, [messages, olderLoading, threadId]);

  const handleScroll = React.useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      if (offsetY <= 100) void loadOlderMessages();
    },
    [loadOlderMessages]
  );

  const refreshModels = React.useCallback(async () => {
    const [models, globalModel, preferences] = await Promise.all([
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getPreferences(),
    ]);
    let nextModel = globalModel;
    let nextDisabled = preferences.chatModelDisabled;
    if (threadId) {
      const settings = await AIService.getThreadModelSettings(threadId);
      nextDisabled = settings.chatModelDisabled ?? preferences.chatModelDisabled;
      if (nextDisabled) {
        nextModel = null;
      } else if (settings.selectedModelId) {
        nextModel = models.find((model) => model.id === settings.selectedModelId) ?? globalModel;
      }
    }
    const nextVisionProjector = nextDisabled
      ? null
      : await ModelManagerService.getInstalledVisionProjectorForModel(nextModel?.id);
    setInstalledModels(models);
    if (!threadId && modelChoiceDirtyRef.current) return;
    setActiveModel(nextModel);
    setActiveVisionProjector(nextVisionProjector);
    setModelDisabled(nextDisabled);
  }, [threadId]);

  const refreshModelsQuietly = React.useCallback(() => {
    void refreshModels().catch((modelError) => {
      setError(modelError instanceof Error ? modelError.message : 'Unable to refresh AI models.');
    });
  }, [refreshModels]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const id = routeThreadId && routeThreadId !== 'new' ? routeThreadId : null;
    try {
      if (id) {
        setThreadId(id);
        const page = await loadMessagePage(id);
        setMessages(page.messages);
        hasOlderMessagesRef.current = page.hasOlder;
      } else {
        setThreadId(undefined);
        setMessages([]);
        hasOlderMessagesRef.current = false;
      }
    } finally {
      setLoading(false);
      scrollToBottom(false);
    }
    refreshModelsQuietly();
  }, [refreshModelsQuietly, routeThreadId, scrollToBottom]);

  React.useEffect(() => {
    modelChoiceDirtyRef.current = false;
    void load();
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      refreshModelsQuietly();
      const interval = setInterval(
        refreshModelsQuietly,
        BATTERY_POLL_INTERVALS_MS.chatModelRefresh[reduceModeEnabled ? 'reduced' : 'normal']
      );
      return () => clearInterval(interval);
    }, [reduceModeEnabled, refreshModelsQuietly])
  );

  React.useEffect(() => {
    const showEvent = 'keyboardWillShow';
    const changeEvent = 'keyboardWillChangeFrame';
    const hideEvent = 'keyboardWillHide';
    const handleShow = () => {
      setKeyboardVisible(true);
      scrollToBottom(true);
    };
    const handleHide = () => {
      setKeyboardVisible(false);
    };
    const willShow = Keyboard.addListener(showEvent, handleShow);
    const didShow = Keyboard.addListener('keyboardDidShow', handleShow);
    const willChange = Keyboard.addListener(changeEvent, handleShow);
    const willHide = Keyboard.addListener('keyboardWillHide', handleHide);
    const didHide = Keyboard.addListener('keyboardDidHide', handleHide);
    return () => {
      willShow.remove();
      didShow.remove();
      willChange.remove();
      willHide.remove();
      didHide.remove();
    };
  }, [scrollToBottom]);

  const imageAttachmentsReady =
    !modelDisabled &&
    !!activeModel &&
    isVisionCapableChatModel(activeModel) &&
    !!activeVisionProjector;
  const imageAttachmentReason = modelDisabled
    ? 'Enable an answer model to attach images.'
    : !activeModel
      ? 'Download a vision-capable answer model first.'
      : !isVisionCapableChatModel(activeModel)
        ? `${activeModel.title} is text-only.`
        : !activeVisionProjector
          ? 'Download the matching Gemma vision projector in Settings.'
          : null;

  React.useEffect(() => {
    if (imageAttachmentsReady) return;
    setAttachments((current) => current.filter((attachment) => attachment.type !== 'image'));
  }, [imageAttachmentsReady]);

  function addAttachment(attachment: AiAttachment) {
    setAttachments((current) => {
      if (current.length >= MAX_CHAT_ATTACHMENTS) {
        setError(`Attach up to ${MAX_CHAT_ATTACHMENTS} items at a time.`);
        return current;
      }
      if (
        'sourceId' in attachment &&
        attachment.sourceId &&
        current.some((item) => 'sourceId' in item && item.sourceId === attachment.sourceId)
      ) {
        return current;
      }
      if (
        attachment.type === 'image' &&
        current.some((item) => item.type === 'image' && item.uri === attachment.uri)
      ) {
        return current;
      }
      return [
        ...current,
        { ...attachment, localId: `${attachment.type}-${Date.now()}-${current.length}` },
      ];
    });
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.localId !== id));
  }

  async function openLibraryPicker() {
    setContextSheetOpen(false);
    setLibrarySheetOpen(true);
    setContextLoading(true);
    setError(null);
    try {
      const [packs, docs] = await Promise.all([
        ContentPackService.listPacks(),
        ImportService.listDocuments(),
      ]);
      setLibraryPacks(
        packs.filter((pack) => pack.installed && pack.category !== 'AI Models').slice(0, 24)
      );
      setDocuments(docs.slice(0, 24));
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : 'Unable to load library.');
    } finally {
      setContextLoading(false);
    }
  }

  async function openNotesPicker() {
    setContextSheetOpen(false);
    if (!vaultUnlocked) {
      setError('Unlock the vault before attaching secure notes.');
      return;
    }
    setNotesSheetOpen(true);
    setContextLoading(true);
    setError(null);
    try {
      setNotes((await NotesRepository.list()).slice(0, 32));
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : 'Unable to load notes.');
    } finally {
      setContextLoading(false);
    }
  }

  async function pickImage(source: 'camera' | 'library') {
    if (!imageAttachmentsReady) {
      setError(imageAttachmentReason ?? 'Image attachments are unavailable.');
      return;
    }
    setContextSheetOpen(false);
    setError(null);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        source === 'camera' ? 'Camera permission is required.' : 'Photo access is required.'
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            exif: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.72,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            exif: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.72,
          });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    addAttachment({
      type: 'image',
      title: asset.fileName ?? (source === 'camera' ? 'Camera photo' : 'Library image'),
      uri: asset.uri,
      mimeType: inferImageMimeType(asset.uri, asset.mimeType ?? null),
    });
  }

  function attachLibraryPack(pack: ContentPack) {
    addAttachment({
      type: 'library',
      title: pack.title,
      sourceId: pack.id,
      content: describeLibraryPack(pack),
    });
    setLibrarySheetOpen(false);
  }

  function attachDocument(document: ArkDocument) {
    addAttachment({
      type: 'document',
      title: document.title,
      sourceId: document.id,
      content: describeDocumentAttachment(document),
    });
    setLibrarySheetOpen(false);
  }

  function attachNote(note: Note) {
    addAttachment({
      type: 'note',
      title: note.title,
      sourceId: note.id,
      content: note.body.slice(0, ATTACHMENT_CONTEXT_CHARS),
    });
    setNotesSheetOpen(false);
  }

  async function send(textOverride?: string) {
    const trimmed = (textOverride ?? content).trim();
    if ((!trimmed && !attachments.length) || sending) return;
    const messageText = trimmed || promptForAttachments(attachments);
    const composerAttachments = attachments;
    const sendAttachments = attachments.map(({ localId: _localId, ...attachment }) => attachment);
    const runId = sendRunIdRef.current + 1;
    sendRunIdRef.current = runId;
    setSending(true);
    setAttachments([]);
    setPendingUserMessage({
      id: `pending-user-${runId}`,
      threadId: threadId ?? 'pending-thread',
      role: 'user',
      content: messageText,
      citations: [],
      metadata: sendAttachments.length
        ? { attachments: messageAttachmentsFromAttachments(sendAttachments) }
        : undefined,
      createdAt: Date.now(),
    });
    setStreamingText('');
    setStreamingReasoning('');
    setProgressEvents([]);
    setError(null);
    setContent('');
    try {
      const sendMessagePromise = AIService.sendMessage(
        {
          threadId,
          content: messageText,
          useRag: true,
          selectedModelId: activeModel?.id ?? null,
          chatModelDisabled: modelDisabled,
          attachments: sendAttachments,
        },
        {
          onProgress: (progress) => {
            if (sendRunIdRef.current === runId) {
              setProgressEvents((current) => appendProgressEvent(current, progress));
            }
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
      const result = await sendMessagePromise;
      setThreadId(result.threadId);
      setPendingUserMessage(null);
      setMessages((current) => [...current, ...result.messages]);
      setAttachments([]);
      scrollToBottom(true);
      if (!threadId) {
        router.replace(`/chat/${result.threadId}` as never);
      }
    } catch (sendError) {
      if (isAiRequestCancelledError(sendError)) return;
      setPendingUserMessage(null);
      setContent(trimmed);
      setAttachments(composerAttachments);
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      if (sendRunIdRef.current === runId) {
        setStreamingText('');
        setStreamingReasoning('');
        setProgressEvents([]);
        setSending(false);
      }
    }
  }

  async function clearThread() {
    if (!threadId) return;
    await AIService.clearThread(threadId);
    router.replace('/(tabs)/chat' as never);
  }

  async function deleteUserMessage() {
    if (!deleteConfirmMessage) return;
    await AIService.deleteMessage(deleteConfirmMessage.id);
    setMessages((current) => current.filter((message) => message.id !== deleteConfirmMessage.id));
    setDeleteConfirmMessage(null);
  }

  const stopResponse = React.useCallback(async () => {
    if (!sending && !pendingUserMessage && !streamingText && !streamingReasoning) return;
    sendRunIdRef.current += 1;
    setSending(false);
    setPendingUserMessage(null);
    setStreamingText('');
    setStreamingReasoning('');
    setProgressEvents([]);
    await AIService.cancelActiveResponse(threadId ?? undefined);
  }, [pendingUserMessage, sending, streamingReasoning, streamingText, threadId]);

  async function selectModel(model: ContentPack) {
    modelChoiceDirtyRef.current = true;
    if (threadId) {
      await AIService.updateThreadModelSettings(threadId, {
        selectedModelId: model.id,
        chatModelDisabled: false,
      });
    }
    setActiveModel(model);
    setActiveVisionProjector(
      await ModelManagerService.getInstalledVisionProjectorForModel(model.id)
    );
    setModelDisabled(false);
  }

  async function disableModel() {
    modelChoiceDirtyRef.current = true;
    if (threadId) {
      await AIService.updateThreadModelSettings(threadId, {
        selectedModelId: null,
        chatModelDisabled: true,
      });
    }
    setActiveModel(null);
    setActiveVisionProjector(null);
    setModelDisabled(true);
    setAttachments((current) => current.filter((attachment) => attachment.type !== 'image'));
  }

  const speakAssistantMessage = React.useCallback(
    async (message: AiMessage) => {
      if (speakingMessageId === message.id) {
        speechPlayback.stop();
        setSpeakingMessageId(null);
        return;
      }
      setError(null);
      setSpeakingMessageId(message.id);
      try {
        await speechPlayback.speak(normalizeReasoningOutput(message.content).content);
      } catch (speechError) {
        setError(
          speechError instanceof Error ? speechError.message : 'Unable to play this response.'
        );
      } finally {
        setSpeakingMessageId(null);
      }
    },
    [speakingMessageId, speechPlayback]
  );

  const confirmClear = React.useCallback(() => {
    if (!threadId) return;
    Keyboard.dismiss();
    setKeyboardVisible(false);
    setClearConfirmOpen(true);
  }, [threadId]);

  const data = React.useMemo(
    () => [
      ...buildChatListItems(messages).map((item) => ({
        kind: 'message' as const,
        id: item.message.id,
        item,
      })),
      ...(pendingUserMessage
        ? [
            {
              kind: 'message' as const,
              id: pendingUserMessage.id,
              item: { message: pendingUserMessage, activityMessages: [] },
            },
          ]
        : []),
      ...(sending
        ? [
            {
              kind: 'streaming' as const,
              id: 'streaming-response',
            },
          ]
        : []),
    ],
    [messages, pendingUserMessage, sending]
  );

  const renderItem = React.useCallback(
    ({
      item,
    }: {
      item: { kind: 'message'; id: string; item: ChatListItem } | { kind: 'streaming'; id: string };
    }) => {
      return item.kind === 'streaming' ? (
        <StreamingChatMessage
          content={streamingText}
          reasoning={streamingReasoning}
          progressEvents={progressEvents}
          onStop={() => void stopResponse()}
        />
      ) : (
        <ChatMessage
          message={item.item.message}
          activityMessages={item.item.activityMessages}
          onDeleteUserMessage={setDeleteConfirmMessage}
          onSpeakAssistant={speakAssistantMessage}
          speaking={speakingMessageId === item.item.message.id}
          speechStatusLabel={
            speakingMessageId === item.item.message.id && !speechPlayback.isReady
              ? `Loading voice ${Math.round(speechPlayback.downloadProgress * 100)}%`
              : speakingMessageId === item.item.message.id && speechPlayback.isPreparing
                ? 'Preparing voice'
                : undefined
          }
        />
      );
    },
    [
      progressEvents,
      speakAssistantMessage,
      speakingMessageId,
      speechPlayback.downloadProgress,
      speechPlayback.isPreparing,
      speechPlayback.isReady,
      stopResponse,
      streamingReasoning,
      streamingText,
    ]
  );
  const emptyThread = messages.length === 0 && !sending;
  const messageListContentStyle = React.useMemo(
    () => ({
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
    }),
    []
  );
  const messageListFooter = React.useMemo(() => <View className="h-[168px]" />, []);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Arky',
          headerLeft: () => (
            <Button
              accessibilityLabel="Back to chats"
              className="h-9 w-9 rounded-full"
              size="icon"
              variant="ghost"
              onPress={() => router.replace('/(tabs)/chat' as never)}>
              <Icon as={ChevronLeft} className="text-foreground size-5" />
            </Button>
          ),
          headerRight: () => (
            <View className="flex-row items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full"
                onPress={() => setModelInfoOpen(true)}>
                <Icon as={Bot} className="text-foreground size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full"
                disabled={!threadId || sending}
                onPress={confirmClear}>
                <Icon as={Trash2} className="text-foreground size-4" />
              </Button>
            </View>
          ),
        }}
      />

      {loading ? (
        <View className="flex-1 gap-3 p-4" style={{ paddingBottom: MESSAGE_LIST_BOTTOM_PADDING }}>
          <Skeleton className="h-24 w-[86%]" />
          <Skeleton className="ml-auto h-16 w-[72%]" />
          <Skeleton className="h-28 w-[92%]" />
          <Text variant="muted">Loading local thread...</Text>
        </View>
      ) : emptyThread ? (
        <Pressable
          className="flex-1 justify-end px-4"
          style={{ paddingBottom: MESSAGE_LIST_BOTTOM_PADDING + 176 }}
          onPress={() => Keyboard.dismiss()}>
          {!keyboardVisible ? (
            <View className="gap-2">
              <Text variant="large">What do you need to know?</Text>
              <Text variant="muted">
                Ask about downloaded guides, notes, saved maps, cached alerts, or weather.
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <FlatList
          ref={flatListRef}
          className="flex-1"
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={messageListContentStyle}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            olderLoading ? (
              <View className="items-center py-3">
                <ActivityIndicator size="small" />
              </View>
            ) : null
          }
          ListFooterComponent={messageListFooter}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {keyboardVisible ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()} />
      ) : null}

      <ChatInput
        value={content}
        disabled={sending}
        errorMessage={error}
        attachments={attachments}
        keyboardVisible={keyboardVisible}
        showPrompts={emptyThread && !keyboardVisible}
        onChangeText={setContent}
        onDismissError={() => setError(null)}
        onRemoveAttachment={removeAttachment}
        onVoiceError={setError}
        onKeyboardVisibleChange={setKeyboardVisible}
        onAddContextPress={() => setContextSheetOpen(true)}
        onPromptPress={setContent}
        onSubmit={(textOverride) => void send(textOverride)}
      />

      <ArkBottomSheet
        visible={contextSheetOpen}
        title="Add context"
        onDismiss={() => setContextSheetOpen(false)}>
        <Button
          variant="ghost"
          className="h-11 justify-start px-2"
          onPress={() => void openLibraryPicker()}>
          <Icon as={BookOpen} className="size-4" />
          <Text>Library</Text>
        </Button>
        <Button
          variant="ghost"
          className="h-11 justify-start px-2"
          disabled={!vaultUnlocked}
          onPress={() => void openNotesPicker()}>
          <Icon as={NotebookPen} className="size-4" />
          <Text>Notes</Text>
        </Button>
        <Button
          variant="ghost"
          className="h-11 justify-start px-2"
          disabled={!imageAttachmentsReady}
          onPress={() => void pickImage('library')}>
          <Icon as={ImageIcon} className="size-4" />
          <Text>Choose picture</Text>
        </Button>
        <Button
          variant="ghost"
          className="h-11 justify-start px-2"
          disabled={!imageAttachmentsReady}
          onPress={() => void pickImage('camera')}>
          <Icon as={Camera} className="size-4" />
          <Text>Take picture</Text>
        </Button>
        {!vaultUnlocked ? (
          <Text variant="small" className="text-muted-foreground px-2">
            Unlock the vault to attach notes.
          </Text>
        ) : null}
        {!imageAttachmentsReady && imageAttachmentReason ? (
          <Text variant="small" className="text-muted-foreground px-2">
            {imageAttachmentReason}
          </Text>
        ) : null}
      </ArkBottomSheet>

      <ArkBottomSheet
        visible={librarySheetOpen}
        title="Attach from Library"
        onDismiss={() => setLibrarySheetOpen(false)}
        scrollable
        maxDynamicContentSize={620}>
        {contextLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator />
          </View>
        ) : (
          <View className="gap-2">
            {[...libraryPacks, ...documents].length ? null : (
              <Text variant="muted" className="px-1 py-2">
                No installed library items or imported documents are available yet.
              </Text>
            )}
            {libraryPacks.map((item) => (
              <ContextChoice
                key={item.id}
                icon={BookOpen}
                title={item.title}
                description={`${item.category} / ${item.format.toUpperCase()}`}
                onPress={() => attachLibraryPack(item)}
              />
            ))}
            {documents.map((document) => (
              <ContextChoice
                key={document.id}
                icon={FileText}
                title={document.title}
                description={
                  document.ocrText || document.extractedText
                    ? 'Extracted text available'
                    : 'Imported document'
                }
                onPress={() => attachDocument(document)}
              />
            ))}
          </View>
        )}
      </ArkBottomSheet>

      <ArkBottomSheet
        visible={notesSheetOpen}
        title="Attach Note"
        onDismiss={() => setNotesSheetOpen(false)}
        scrollable
        maxDynamicContentSize={620}>
        {contextLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator />
          </View>
        ) : (
          <View className="gap-2">
            {notes.length ? null : (
              <Text variant="muted" className="px-1 py-2">
                No secure notes are available.
              </Text>
            )}
            {notes.map((note) => (
              <ContextChoice
                key={note.id}
                icon={NotebookPen}
                title={note.title}
                description={note.body || 'Empty note'}
                onPress={() => attachNote(note)}
              />
            ))}
          </View>
        )}
      </ArkBottomSheet>

      <ConfirmModal
        visible={clearConfirmOpen}
        title="Delete chat?"
        description="This removes this local chat and its messages from this device."
        confirmLabel="Delete"
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          setClearConfirmOpen(false);
          void clearThread();
        }}
      />

      <ConfirmModal
        visible={!!deleteConfirmMessage}
        title="Delete message?"
        description="This removes your message from this local thread and future context."
        confirmLabel="Delete"
        onCancel={() => setDeleteConfirmMessage(null)}
        onConfirm={() => void deleteUserMessage()}
      />

      <ArkBottomSheet
        visible={modelInfoOpen}
        title="AI model settings"
        description="Choose an answer model. Source search uses built-in ExecuTorch embeddings."
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
            active={modelDisabled}
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

        <View className="mt-4 gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={Search} className="text-primary size-5" />
            <Text variant="large">Source search</Text>
          </View>
          <Text variant="muted" className="px-1 py-2">
            Ark uses the built-in ExecuTorch multi-qa MiniLM embedding model for local retrieval.
          </Text>
        </View>
      </ArkBottomSheet>
    </View>
  );
}
