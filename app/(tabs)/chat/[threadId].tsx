import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { MarkdownText } from '@/components/ui/markdown-text';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAppHeaderActions } from '@/components/layout/app-header-actions';
import { NAV_THEME } from '@/lib/theme';
import { AIService, isAiRequestCancelledError } from '@/services/ai/ai.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';
import { useThemeStore } from '@/stores/theme-store';
import type { AiCitation, AiMessage, AiProgressEvent } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  Brain,
  Bot,
  ChevronDown,
  Check,
  ExternalLink,
  Mic,
  Plus,
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
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE_SIZE = 60;
const COMPOSER_HEIGHT = 56;
const COMPOSER_SIDE_PADDING = 12;
const COMPOSER_OPEN_GAP = 10;
const COMPOSER_BOTTOM_GAP = 14;
const COMPOSER_BOTTOM_GAP_FOCUSED = 10;
const MESSAGE_LIST_BOTTOM_PADDING = 168;
const EMPTY_THREAD_PROMPTS = [
  'Create a survival checklist for tonight',
  'Write or edit a field note',
  'Look up water purification guidance',
];
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CitationItem({ citation, index }: { citation: AiCitation; index: number }) {
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
        [{index + 1}] {citation.title}
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

function SourceMentions({ content, citations }: { content: string; citations: AiCitation[] }) {
  const mentioned = React.useMemo(
    () =>
      citations
        .map((citation, index) => ({ citation, index }))
        .filter(({ citation, index }) => {
          if (content.includes(`[${index + 1}]`)) return true;
          const title = citation.title.trim();
          const section = citation.sectionTitle?.trim();
          return !!(
            (title && content.toLowerCase().includes(title.toLowerCase())) ||
            (section && content.toLowerCase().includes(section.toLowerCase()))
          );
        }),
    [citations, content]
  );

  if (!mentioned.length) return null;

  return (
    <View className="flex-row flex-wrap gap-1">
      {mentioned.map(({ citation, index }) => (
        <Button
          key={`${citation.sourceId}-${index}`}
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={!citation.targetHref}
          onPress={() => citation.targetHref && router.push(citation.targetHref as never)}>
          <Text variant="small">[{index + 1}]</Text>
        </Button>
      ))}
    </View>
  );
}

function SourcesPanel({ messageId, citations }: { messageId: string; citations: AiCitation[] }) {
  const [open, setOpen] = React.useState(false);
  if (!citations.length) return null;

  return (
    <View className="border-border rounded-md border">
      <Button
        variant="ghost"
        className="h-10 justify-between px-3"
        onPress={() => setOpen((current) => !current)}>
        <View className="flex-row items-center gap-2">
          <Icon as={ExternalLink} className="text-primary size-4" />
          <Text variant="small" className="text-muted-foreground uppercase">
            {citations.length} {citations.length === 1 ? 'source' : 'sources'}
          </Text>
        </View>
        <Icon as={ChevronDown} className={open ? 'size-4 rotate-180' : 'size-4'} />
      </Button>
      {open ? (
        <View className="border-border gap-2 border-t px-3 py-2">
          {citations.map((citation, index) => (
            <CitationItem
              key={`${messageId}-${citation.sourceId}-${index}`}
              citation={citation}
              index={index}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type TraceAction = {
  summary: string;
  tool?: string;
  active?: boolean;
};

function ProcessPanel({
  actions,
  reasoning,
  defaultOpen = false,
  streaming = false,
}: {
  actions?: TraceAction[];
  reasoning?: string;
  defaultOpen?: boolean;
  streaming?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const visibleActions = actions?.filter((action) => action.summary.trim()) ?? [];
  const hasReasoning = !!reasoning?.trim();
  if (!visibleActions.length && !hasReasoning) return null;

  return (
    <View className="border-border rounded-md border">
      <Button
        variant="ghost"
        className="h-10 justify-between px-3"
        onPress={() => setOpen((current) => !current)}>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Icon as={Search} className="text-primary size-4" />
          <Text variant="small" className="text-muted-foreground uppercase">
            Process
          </Text>
          {streaming ? <ActivityIndicator size="small" /> : null}
        </View>
        <Icon as={ChevronDown} className={open ? 'size-4 rotate-180' : 'size-4'} />
      </Button>
      {open ? (
        <View className="border-border gap-3 border-t px-3 py-2">
          {visibleActions.length ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={Search} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground uppercase">
                  Activity
                </Text>
              </View>
              {visibleActions.map((action, index) => (
                <View key={`${action.summary}-${index}`} className="flex-row gap-2">
                  <Text variant="small" className="text-primary">
                    {index + 1}.
                  </Text>
                  <Text variant="small" className="text-muted-foreground flex-1 leading-5">
                    {action.summary}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {hasReasoning ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={Brain} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground uppercase">
                  Thinking
                </Text>
              </View>
              <Text variant="small" className="text-muted-foreground leading-5" selectable>
                {reasoning}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
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

function MessageBubble({
  message,
  activityMessages = [],
  onDeleteUserMessage,
}: {
  message: AiMessage;
  activityMessages?: AiMessage[];
  onDeleteUserMessage: (message: AiMessage) => void;
}) {
  if (message.role === 'tool') {
    return null;
  }

  const assistant = message.role === 'assistant';
  const normalized = assistant ? normalizeReasoningOutput(message.content) : null;
  const displayContent = normalized?.content || message.content;
  const displayReasoning = joinReasoning(message.reasoning ?? '', normalized?.reasoning ?? '');
  const actions = actionsFromToolMessages(activityMessages);

  const bubble = (
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
        <>
          <MarkdownText>{displayContent}</MarkdownText>
          <SourceMentions content={displayContent} citations={message.citations} />
        </>
      ) : (
        <Text selectable className="text-primary-foreground">
          {message.content}
        </Text>
      )}
      {assistant ? (
        <ProcessPanel actions={actions} reasoning={displayReasoning} defaultOpen={false} />
      ) : null}
      {assistant ? <SourcesPanel messageId={message.id} citations={message.citations} /> : null}
    </Card>
  );

  return (
    <View className={assistant ? 'items-start' : 'items-end'}>
      {assistant ? (
        bubble
      ) : (
        <Pressable onLongPress={() => onDeleteUserMessage(message)}>{bubble}</Pressable>
      )}
    </View>
  );
}

function StreamingBubble({
  content,
  reasoning,
  progressEvents,
  onStop,
}: {
  content: string;
  reasoning: string;
  progressEvents: AiProgressEvent[];
  onStop: () => void;
}) {
  const actions = progressEvents.map((event) => ({ summary: event.label, active: true }));

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
          <Button size="icon" variant="ghost" onPress={onStop}>
            <Icon as={StopCircle} className="size-4" />
          </Button>
        </View>
        <ProcessPanel actions={actions} reasoning={reasoning} defaultOpen streaming />
        {content ? (
          <MarkdownText>{content}</MarkdownText>
        ) : (
          <Text variant="muted">{progressEvents.at(-1)?.label || 'Starting...'}</Text>
        )}
      </Card>
    </View>
  );
}

function joinReasoning(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

type ChatListItem = {
  message: AiMessage;
  activityMessages: AiMessage[];
};

function buildChatListItems(messages: AiMessage[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  let pendingActivity: AiMessage[] = [];
  for (const message of messages) {
    if (message.role === 'tool') {
      pendingActivity.push(message);
      continue;
    }
    items.push({
      message,
      activityMessages: message.role === 'assistant' ? pendingActivity : [],
    });
    pendingActivity = [];
  }
  return items;
}

function actionsFromToolMessages(messages: AiMessage[]): TraceAction[] {
  return messages.flatMap((message) => {
    if (message.metadata?.actions?.length) return message.metadata.actions;
    return message.content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((summary) => ({ summary }));
  });
}

function appendProgressEvent(events: AiProgressEvent[], next: AiProgressEvent) {
  const last = events[events.length - 1];
  if (last?.stage === next.stage && last.label === next.label) return events;
  return [...events, next].slice(-8);
}

function FloatingComposer({
  value,
  disabled,
  keyboardVisible,
  showPrompts,
  onChangeText,
  onKeyboardVisibleChange,
  onPromptPress,
  onSubmit,
}: {
  value: string;
  disabled: boolean;
  keyboardVisible: boolean;
  showPrompts: boolean;
  onChangeText: (text: string) => void;
  onKeyboardVisibleChange: (visible: boolean) => void;
  onPromptPress: (prompt: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = React.useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;
  const [isFocused, setIsFocused] = React.useState(false);
  const keyboardProgress = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);

  const calculateKeyboardOffset = React.useCallback(
    (event: { endCoordinates?: { height?: number; screenY?: number } } | undefined, fallbackOffset: number) => {
      const input = inputRef.current;
      if (!input || !event?.endCoordinates) {
        keyboardOffset.value = withTiming(fallbackOffset, {
          duration: 220,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        });
        return;
      }

      input.measure((_x, _y, _width, height, _pageX, pageY) => {
        const keyboardTop =
          typeof event.endCoordinates?.screenY === 'number'
            ? event.endCoordinates.screenY
            : windowHeight - (event.endCoordinates?.height ?? 0);
        const inputBottom = pageY + height;
        const overlap = Math.max(0, inputBottom + COMPOSER_BOTTOM_GAP_FOCUSED - keyboardTop);

        keyboardOffset.value = withTiming(overlap, {
          duration: 220,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        });
      });
    },
    [keyboardOffset, windowHeight]
  );

  const animateKeyboard = React.useCallback(
    (visible: boolean, event?: { duration?: number; endCoordinates?: { height?: number; screenY?: number } }) => {
      const duration = Math.min(Math.max(event?.duration ?? 220, 160), 280);
      const screenY = event?.endCoordinates?.screenY;
      const eventHeight = event?.endCoordinates?.height ?? 0;
      const measuredOffset =
        typeof screenY === 'number' ? Math.max(0, windowHeight - screenY) : eventHeight;
      const easing = Easing.bezier(0.2, 0.8, 0.2, 1);

      keyboardProgress.value = withTiming(visible ? 1 : 0, { duration, easing });
      if (visible) {
        const fallbackOffset = measuredOffset;
        if (Platform.OS === 'android') {
          keyboardOffset.value = withTiming(fallbackOffset, { duration, easing });
        } else {
          requestAnimationFrame(() => calculateKeyboardOffset(event, fallbackOffset));
          setTimeout(() => calculateKeyboardOffset(event, fallbackOffset), 80);
        }
      } else {
        keyboardOffset.value = withTiming(0, { duration, easing });
      }
      onKeyboardVisibleChange(visible);
    },
    [calculateKeyboardOffset, keyboardOffset, keyboardProgress, onKeyboardVisibleChange, windowHeight]
  );

  React.useEffect(() => {
    const handleShow = (event: { duration?: number; endCoordinates?: { height?: number; screenY?: number } }) =>
      animateKeyboard(true, event);
    const handleHide = (event: { duration?: number; endCoordinates?: { height?: number; screenY?: number } }) =>
      animateKeyboard(false, event);
    const willShow = Keyboard.addListener('keyboardWillShow', handleShow);
    const didShow = Keyboard.addListener('keyboardDidShow', handleShow);
    const willChange = Keyboard.addListener('keyboardWillChangeFrame', handleShow);
    const willHide = Keyboard.addListener('keyboardWillHide', handleHide);
    const didHide = Keyboard.addListener('keyboardDidHide', handleHide);
    return () => {
      willShow.remove();
      didShow.remove();
      willChange.remove();
      willHide.remove();
      didHide.remove();
    };
  }, [animateKeyboard]);

  React.useEffect(() => {
    if (isFocused) {
      keyboardProgress.value = withTiming(1, {
        duration: 220,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      });
    } else if (!keyboardVisible) {
      keyboardProgress.value = withTiming(0, {
        duration: 220,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      });
    }
  }, [isFocused, keyboardProgress, keyboardVisible]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardOffset.value }],
  }));

  const detachedPlusStyle = useAnimatedStyle(() => {
    const progress = keyboardProgress.value;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [0, 0.72, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress, [0, 1], [0.8, 1], Extrapolation.CLAMP) }],
      width: interpolate(progress, [0, 1], [0, COMPOSER_HEIGHT], Extrapolation.CLAMP),
      marginRight: interpolate(progress, [0, 1], [0, COMPOSER_OPEN_GAP], Extrapolation.CLAMP),
    };
  });

  const embeddedPlusStyle = useAnimatedStyle(() => {
    const progress = keyboardProgress.value;
    return {
      opacity: interpolate(progress, [0, 0.7, 1], [1, 0.2, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress, [0, 1], [1, 0.7], Extrapolation.CLAMP) }],
      width: interpolate(progress, [0, 1], [38, 0], Extrapolation.CLAMP),
    };
  });

  const bottomPadding = Math.max(
    insets.bottom + (keyboardVisible ? COMPOSER_BOTTOM_GAP_FOCUSED : COMPOSER_BOTTOM_GAP),
    keyboardVisible ? COMPOSER_BOTTOM_GAP_FOCUSED : 24
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.composerContainer, { paddingBottom: bottomPadding }, containerStyle]}>
      {showPrompts ? (
        <View style={styles.promptList}>
          {EMPTY_THREAD_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => {
                onPromptPress(prompt);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              style={[styles.promptChip, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text variant="small">{prompt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.composerRow}>
        <AnimatedPressable
          accessibilityRole="button"
          disabled={!keyboardVisible}
          onPress={() => undefined}
          style={[styles.detachedPlusButton, detachedPlusStyle]}>
          <Icon as={Plus} className="text-foreground size-5" />
        </AnimatedPressable>

        <Animated.View style={styles.inputPill}>
          <Animated.View style={[styles.embeddedPlus, embeddedPlusStyle]}>
            <Icon as={Plus} className="text-foreground size-5" />
          </Animated.View>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={onSubmit}
            placeholder="Ask Arky"
            placeholderTextColor="#9CA3AF"
            returnKeyType="send"
            editable={!disabled}
            multiline={false}
            style={[styles.composerInput, { color: colors.text }]}
          />
          <View style={styles.micButton}>
            <Icon as={Mic} className="text-muted-foreground size-5" />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || !value.trim()}
            onPress={onSubmit}
            style={[
              styles.voiceButton,
              { backgroundColor: colors.primary, opacity: disabled || !value.trim() ? 0.54 : 1 },
            ]}>
            {disabled ? (
              <ActivityIndicator color={colors.primary === '#F2B84B' ? '#0A0A0A' : '#FFFFFF'} />
            ) : (
              <Icon as={Send} color={colors.primary === '#F2B84B' ? '#0A0A0A' : '#FFFFFF'} size={19} />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const { threadId: routeThreadId } = useLocalSearchParams<{ threadId?: string }>();
  const navigation = useNavigation();
  const initialThreadId = routeThreadId && routeThreadId !== 'new' ? routeThreadId : undefined;
  const [threadId, setThreadId] = React.useState<string | undefined>(initialThreadId);
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [modelDisabled, setModelDisabled] = React.useState(false);
  const [activeEmbeddingModel, setActiveEmbeddingModel] = React.useState<ContentPack | null>(null);
  const [modelInfoOpen, setModelInfoOpen] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = React.useState<AiMessage | null>(null);
  const [sending, setSending] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState('');
  const [streamingReasoning, setStreamingReasoning] = React.useState('');
  const [progressEvents, setProgressEvents] = React.useState<AiProgressEvent[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = React.useState<AiMessage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [olderLoading, setOlderLoading] = React.useState(false);
  const [hasOlderMessages, setHasOlderMessages] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const sendRunIdRef = React.useRef(0);

  const refreshModels = React.useCallback(async () => {
    const [models, globalModel, embeddingModel, preferences] = await Promise.all([
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getActiveEmbeddingModel(),
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
    setInstalledModels(models);
    setActiveModel(nextModel);
    setActiveEmbeddingModel(embeddingModel);
    setModelDisabled(nextDisabled);
  }, [threadId]);

  async function load() {
    setLoading(true);
    const id = routeThreadId && routeThreadId !== 'new' ? routeThreadId : null;
    if (id) {
      setThreadId(id);
      const page = await loadMessagePage(id);
      setMessages(page.messages);
      setHasOlderMessages(page.hasOlder);
    } else {
      setThreadId(undefined);
      setMessages([]);
      setHasOlderMessages(false);
    }
    await refreshModels();
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [routeThreadId]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshModels();
      const interval = setInterval(() => void refreshModels(), 2000);
      return () => clearInterval(interval);
    }, [refreshModels])
  );

  React.useEffect(() => {
    const showEvent = 'keyboardWillShow';
    const changeEvent = 'keyboardWillChangeFrame';
    const hideEvent = 'keyboardWillHide';
    const handleShow = () => {
      setKeyboardVisible(true);
    };
    const handleHide = () => {
      setKeyboardVisible(false);
    };
    const willShow = Keyboard.addListener(showEvent, handleShow);
    const didShow = Keyboard.addListener('keyboardDidShow', handleShow);
    const willChange = Keyboard.addListener(changeEvent, handleShow);
    const willHide = Keyboard.addListener(hideEvent, handleHide);
    const didHide = Keyboard.addListener('keyboardDidHide', handleHide);
    return () => {
      willShow.remove();
      didShow.remove();
      willChange.remove();
      willHide.remove();
      didHide.remove();
    };
  }, []);

  async function send() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    const runId = sendRunIdRef.current + 1;
    sendRunIdRef.current = runId;
    setSending(true);
    setPendingUserMessage({
      id: `pending-user-${runId}`,
      threadId: threadId ?? 'pending-thread',
      role: 'user',
      content: trimmed,
      citations: [],
      createdAt: Date.now(),
    });
    setStreamingText('');
    setStreamingReasoning('');
    setProgressEvents([]);
    setError(null);
    setContent('');
    try {
      const result = await AIService.sendMessage(
        {
          threadId,
          content: trimmed,
          useRag: true,
          selectedModelId: activeModel?.id ?? null,
          chatModelDisabled: modelDisabled,
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
      setThreadId(result.threadId);
      setPendingUserMessage(null);
      setMessages((current) => [...current, ...result.messages]);
      if (!threadId) {
        router.replace(`/(tabs)/chat/${result.threadId}` as never);
      }
    } catch (sendError) {
      if (isAiRequestCancelledError(sendError)) return;
      setPendingUserMessage(null);
      setContent(trimmed);
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

  async function loadOlderMessages() {
    if (!threadId || olderLoading || !hasOlderMessages || !messages.length) return;
    setOlderLoading(true);
    try {
      const page = await loadMessagePage(threadId, messages[0].createdAt);
      setMessages((current) => [...page.messages, ...current]);
      setHasOlderMessages(page.hasOlder);
    } finally {
      setOlderLoading(false);
    }
  }

  async function deleteUserMessage() {
    if (!deleteConfirmMessage) return;
    await AIService.deleteMessage(deleteConfirmMessage.id);
    setMessages((current) => current.filter((message) => message.id !== deleteConfirmMessage.id));
    setDeleteConfirmMessage(null);
  }

  async function stopResponse() {
    sendRunIdRef.current += 1;
    setSending(false);
    setPendingUserMessage(null);
    setStreamingText('');
    setStreamingReasoning('');
    setProgressEvents([]);
    await AIService.cancelActiveResponse();
  }

  async function selectModel(model: ContentPack) {
    if (threadId) {
      await AIService.updateThreadModelSettings(threadId, {
        selectedModelId: model.id,
        chatModelDisabled: false,
      });
    }
    setActiveModel(model);
    setModelDisabled(false);
  }

  async function disableModel() {
    if (threadId) {
      await AIService.updateThreadModelSettings(threadId, {
        selectedModelId: null,
        chatModelDisabled: true,
      });
    }
    setActiveModel(null);
    setModelDisabled(true);
  }

  function confirmClear() {
    if (!threadId) return;
    Keyboard.dismiss();
    setKeyboardVisible(false);
    setClearConfirmOpen(true);
  }

  React.useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: 'none' },
    });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  const headerActions = React.useMemo(
    () => (
      <>
        <Button size="icon" variant="ghost" onPress={() => setModelInfoOpen(true)}>
          <Icon as={Bot} className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" disabled={!threadId || sending} onPress={confirmClear}>
          <Icon as={Trash2} className="size-4" />
        </Button>
      </>
    ),
    [confirmClear, sending, threadId]
  );
  useAppHeaderActions(headerActions, [headerActions]);

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
  const emptyThread = messages.length === 0 && !sending;

  return (
    <View className="bg-background flex-1">
      {loading ? (
        <View className="flex-1 gap-3 p-4" style={{ paddingBottom: MESSAGE_LIST_BOTTOM_PADDING }}>
          <Skeleton className="h-24 w-[86%]" />
          <Skeleton className="ml-auto h-16 w-[72%]" />
          <Skeleton className="h-28 w-[92%]" />
          <Text variant="muted">Loading local thread...</Text>
        </View>
      ) : emptyThread ? (
        <View className="flex-1 justify-end px-4" style={{ paddingBottom: MESSAGE_LIST_BOTTOM_PADDING + 176 }}>
          {!keyboardVisible ? (
            <View className="gap-2">
              <Text variant="large">What do you need to know?</Text>
              <Text variant="muted">
                Ask about downloaded guides, notes, saved maps, cached alerts, or weather.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          className="flex-1"
          inverted
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            item.kind === 'streaming' ? (
              <StreamingBubble
                content={streamingText}
                reasoning={streamingReasoning}
                progressEvents={progressEvents}
                onStop={() => void stopResponse()}
              />
            ) : (
              <MessageBubble
                message={item.item.message}
                activityMessages={item.item.activityMessages}
                onDeleteUserMessage={setDeleteConfirmMessage}
              />
            )
          }
          contentContainerStyle={{
            gap: 12,
            padding: 16,
            paddingBottom: MESSAGE_LIST_BOTTOM_PADDING,
            paddingTop: 56,
          }}
          onEndReached={() => void loadOlderMessages()}
          onEndReachedThreshold={0.15}
          ListFooterComponent={
            olderLoading ? (
              <View className="items-center py-3">
                <ActivityIndicator size="small" />
              </View>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      {error ? (
        <View className="border-destructive/40 bg-background/95 border-t px-4 py-2">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      ) : null}

      <FloatingComposer
        value={content}
        disabled={sending}
        keyboardVisible={keyboardVisible}
        showPrompts={emptyThread && !keyboardVisible}
        onChangeText={setContent}
        onKeyboardVisibleChange={setKeyboardVisible}
        onPromptPress={setContent}
        onSubmit={() => void send()}
      />

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
        title="Chat AI model"
        description="Choose the answer model for this chat."
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

        <Text variant="muted" className="px-1">
          Source search uses {activeEmbeddingModel?.title ?? 'Ark hash fallback'} from AI settings.
        </Text>
      </ArkBottomSheet>
    </View>
  );
}

async function loadMessagePage(threadId: string, before?: number) {
  const rows = await AIService.listMessages(threadId, { limit: PAGE_SIZE + 1, before });
  return {
    messages: rows.length > PAGE_SIZE ? rows.slice(rows.length - PAGE_SIZE) : rows,
    hasOlder: rows.length > PAGE_SIZE,
  };
}

const styles = StyleSheet.create({
  composerContainer: {
    bottom: 0,
    left: 0,
    paddingHorizontal: COMPOSER_SIDE_PADDING,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  composerInput: {
    flex: 1,
    fontSize: 16,
    height: COMPOSER_HEIGHT,
    lineHeight: 20,
    paddingHorizontal: 2,
  },
  composerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  detachedPlusButton: {
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderColor: '#303030',
    borderRadius: COMPOSER_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    height: COMPOSER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  embeddedPlus: {
    alignItems: 'center',
    height: COMPOSER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inputPill: {
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderColor: '#303030',
    borderRadius: COMPOSER_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    height: COMPOSER_HEIGHT,
    minWidth: 0,
    overflow: 'hidden',
    paddingLeft: 10,
    paddingRight: 6,
  },
  micButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 36,
  },
  promptChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  promptList: {
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  voiceButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
