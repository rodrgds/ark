import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { MarkdownText } from '@/components/ui/markdown-text';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAppHeaderActions } from '@/components/layout/app-header-actions';
import { BATTERY_POLL_INTERVALS_MS } from '@/constants/battery';
import { NAV_COLORS } from '@/constants/theme';
import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import { useArkSpeechToText } from '@/hooks/use-ark-speech-to-text';
import { useArkTextToSpeech } from '@/hooks/use-ark-text-to-speech';
import { useArkVoiceActivity } from '@/hooks/use-ark-voice-activity';
import { useMotionEnabled } from '@/hooks/use-motion-enabled';
import { NAV_THEME } from '@/lib/theme';
import { AIService, isAiRequestCancelledError } from '@/services/ai/ai.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';
import { SpeechRecordingService } from '@/services/audio/speech-recording.service';
import { useThemeStore } from '@/stores/theme-store';
import type { AiCitation, AiMessage, AiProgressEvent } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Brain,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronLeft,
  Check,
  CircleX,
  ExternalLink,
  Mic,
  NotebookPen,
  Plus,
  Search,
  Send,
  Square,
  StopCircle,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  type LayoutChangeEvent,
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
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE_SIZE = 60;
const COMPOSER_HEIGHT = 56;
const COMPOSER_MAX_INPUT_HEIGHT = 132;
const DETACHED_PLUS_SIZE = COMPOSER_HEIGHT;
const COMPOSER_SIDE_PADDING = 12;
const COMPOSER_OPEN_GAP = 10;
const COMPOSER_BOTTOM_GAP = 14;
const COMPOSER_BOTTOM_GAP_FOCUSED = 4;
const MESSAGE_LIST_BOTTOM_PADDING = 168;
const WAVEFORM_INITIAL_SAMPLES = 28;
const WAVEFORM_MIN_SAMPLES = 18;
const WAVEFORM_MAX_SAMPLES = 64;
const WAVEFORM_BAR_WIDTH = 3;
const WAVEFORM_TARGET_STEP = 6;
const EMPTY_THREAD_PROMPTS = [
  'Create a survival checklist for tonight',
  'Write or edit a field note',
  'Look up water purification guidance',
];
const EMPTY_CITATIONS: AiCitation[] = [];
const EMPTY_ACTIVITY_MESSAGES: AiMessage[] = [];
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function makeWaveformSamples(count: number) {
  return Array.from({ length: count }, () => 0.12);
}

function resizeWaveformSamples(samples: number[], count: number) {
  if (samples.length === count) return samples;
  if (samples.length > count) return samples.slice(samples.length - count);
  return [...makeWaveformSamples(count - samples.length), ...samples];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openSource(href: string) {
  if (/^https?:\/\//i.test(href)) {
    router.push({
      pathname: '/content/web-reader',
      params: { url: href },
    });
  } else {
    router.push(href as never);
  }
}

function citationMatchesContent(citation: AiCitation, content: string, index: number) {
  if (content.includes(`[${index + 1}]`)) return true;
  const title = citation.title.trim();
  const section = citation.sectionTitle?.trim();
  return (
    (title && new RegExp(escapeRegExp(title), 'i').test(content)) ||
    (section && new RegExp(escapeRegExp(section), 'i').test(content))
  );
}

function CitationItem({ citation, index }: { citation: AiCitation; index: number }) {
  const locationParts: string[] = [];
  if (citation.sectionTitle) locationParts.push(citation.sectionTitle);
  if (typeof citation.page === 'number') locationParts.push(`page ${citation.page}`);
  const location = locationParts.join(' - ');
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
          onPress={() => openSource(citation.targetHref!)}>
          <Icon as={ExternalLink} className="size-4" />
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}

function SourceMentions({ content, citations }: { content: string; citations: AiCitation[] }) {
  const mentioned = React.useMemo(() => {
    const next: Array<{ citation: AiCitation; index: number }> = [];
    let index = 0;
    for (const citation of citations) {
      if (citationMatchesContent(citation, content, index)) next.push({ citation, index });
      index += 1;
    }
    return next;
  }, [citations, content]);

  if (!mentioned.length) return null;

  return (
    <View className="flex-row flex-wrap gap-1">
      {mentioned.map(({ citation, index }) => (
        <Button
          key={`${citation.sourceId}-${citation.sectionTitle ?? citation.title ?? index}`}
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={!citation.targetHref}
          onPress={() => citation.targetHref && openSource(citation.targetHref)}>
          <Text variant="small">[{index + 1}]</Text>
        </Button>
      ))}
    </View>
  );
}

type TraceAction = {
  summary: string;
  tool?: string;
  active?: boolean;
};

function ProcessPanel({
  messageId,
  actions,
  reasoning,
  citations = EMPTY_CITATIONS,
  defaultOpen = false,
  streaming = false,
}: {
  messageId?: string;
  actions?: TraceAction[];
  reasoning?: string;
  citations?: AiCitation[];
  defaultOpen?: boolean;
  streaming?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const visibleActions = actions?.filter((action) => action.summary.trim()) ?? [];
  const hasReasoning = !!reasoning?.trim();
  const hasCitations = citations.length > 0;

  if (!visibleActions.length && !hasReasoning && !hasCitations) return null;

  return (
    <View className="border-border mt-1 rounded-md border">
      <Button
        variant="ghost"
        className="h-10 justify-between px-3"
        onPress={() => setOpen((current) => !current)}>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Icon as={Brain} className="text-primary size-4" />
          <Text variant="small" className="text-muted-foreground font-semibold uppercase">
            Process & Sources
          </Text>
          {streaming ? <ActivityIndicator size="small" className="ml-1" /> : null}
        </View>
        <Icon as={ChevronDown} className={open ? 'size-4 rotate-180' : 'size-4'} />
      </Button>
      {open ? (
        <View className="border-border gap-4 border-t px-3 py-3">
          {visibleActions.length ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={Search} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground font-semibold uppercase">
                  Activity
                </Text>
              </View>
              <View className="gap-1.5 pl-6">
                {visibleActions.map((action, index) => (
                  <View
                    key={`${action.tool ?? 'action'}-${action.summary}`}
                    className="flex-row items-start gap-2">
                    <Text variant="small" className="text-primary mt-0.5">
                      •
                    </Text>
                    <Text variant="small" className="text-muted-foreground flex-1 leading-5">
                      {action.summary}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {hasCitations ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={ExternalLink} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground font-semibold uppercase">
                  Checked Sources ({citations.length})
                </Text>
              </View>
              <View className="gap-3 pl-6">
                {citations.map((citation, index) => (
                  <CitationItem
                    key={
                      messageId
                        ? `${messageId}-${citation.sourceId}-${index}`
                        : `${citation.sourceId}-${index}`
                    }
                    citation={citation}
                    index={index}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {hasReasoning ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={Brain} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground font-semibold uppercase">
                  Thinking Process
                </Text>
              </View>
              <View className="pl-6">
                <Text variant="small" className="text-muted-foreground leading-5" selectable>
                  {reasoning}
                </Text>
              </View>
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
  activityMessages = EMPTY_ACTIVITY_MESSAGES,
  onDeleteUserMessage,
  onSpeakAssistant,
  speaking,
  speechStatusLabel,
}: {
  message: AiMessage;
  activityMessages?: AiMessage[];
  onDeleteUserMessage: (message: AiMessage) => void;
  onSpeakAssistant?: (message: AiMessage) => void;
  speaking?: boolean;
  speechStatusLabel?: string;
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
      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="small"
          className={assistant ? 'text-primary uppercase' : 'text-primary-foreground uppercase'}>
          {assistant ? 'Arky' : 'You'}
        </Text>
        {assistant && onSpeakAssistant ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            accessibilityLabel={speaking ? 'Stop reading response aloud' : 'Read response aloud'}
            onPress={() => onSpeakAssistant(message)}>
            <Icon as={speaking ? VolumeX : Volume2} className="size-4" />
            <Text variant="small">{speaking ? (speechStatusLabel ?? 'Stop') : 'Read aloud'}</Text>
          </Button>
        ) : null}
      </View>
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
        <ProcessPanel
          messageId={message.id}
          actions={actions}
          reasoning={displayReasoning}
          citations={message.citations}
          defaultOpen={false}
        />
      ) : null}
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
          <MarkdownText streaming>{content}</MarkdownText>
        ) : (
          <Text variant="muted">{progressEvents.at(-1)?.label || 'Starting...'}</Text>
        )}
      </Card>
    </View>
  );
}

function joinReasoning(...parts: string[]) {
  const filtered: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) filtered.push(trimmed);
  }
  return filtered.join('\n\n');
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
  const actions: TraceAction[] = [];
  for (const message of messages) {
    if (message.metadata?.actions?.length) {
      actions.push(...message.metadata.actions);
      continue;
    }
    for (const line of message.content.split('\n')) {
      const summary = line.trim();
      if (summary) actions.push({ summary });
    }
  }
  return actions;
}

function appendProgressEvent(events: AiProgressEvent[], next: AiProgressEvent) {
  const last = events[events.length - 1];
  if (last?.stage === next.stage && last.label === next.label) return events;
  return [...events, next].slice(-8);
}

function FloatingComposer({
  value,
  disabled,
  errorMessage,
  keyboardVisible,
  showPrompts,
  onChangeText,
  onDismissError,
  onVoiceError,
  onKeyboardVisibleChange,
  onAddContextPress,
  onPromptPress,
  onSubmit,
}: {
  value: string;
  disabled: boolean;
  errorMessage?: string | null;
  keyboardVisible: boolean;
  showPrompts: boolean;
  onChangeText: (text: string) => void;
  onDismissError: () => void;
  onVoiceError: (message: string) => void;
  onKeyboardVisibleChange: (visible: boolean) => void;
  onAddContextPress: () => void;
  onPromptPress: (prompt: string) => void;
  onSubmit: (textOverride?: string) => void;
}) {
  const inputRef = React.useRef<TextInput>(null);
  const speechToText = useArkSpeechToText();
  const voiceActivity = useArkVoiceActivity();
  const motionEnabled = useMotionEnabled();
  const voiceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStateRef = React.useRef<'idle' | 'recording' | 'transcribing'>('idle');
  const voiceRecordingSessionRef = React.useRef(0);
  const waveformSampleCountRef = React.useRef(WAVEFORM_INITIAL_SAMPLES);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;
  const themeColors = NAV_COLORS[theme];
  const [voiceState, setVoiceState] = React.useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [inputHeight, setInputHeight] = React.useState(COMPOSER_HEIGHT);
  const [waveformSampleCount, setWaveformSampleCount] = React.useState(WAVEFORM_INITIAL_SAMPLES);
  const keyboardProgress = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const voiceProgress = useSharedValue(0);
  const recordingLevel = useSharedValue(0);
  const waveformSamples = useSharedValue(makeWaveformSamples(WAVEFORM_INITIAL_SAMPLES));
  const hasText = value.length > 0;
  const voiceActive = voiceState !== 'idle';
  const isFocusedRef = React.useRef(false);
  const splitProgress = useDerivedValue(() => Math.max(keyboardProgress.value, voiceProgress.value));

  React.useEffect(
    () => () => {
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
      voiceRecordingSessionRef.current += 1;
      void SpeechRecordingService.cancel();
    },
    []
  );

  const animateKeyboard = React.useCallback(
    (
      visible: boolean,
      event?: { duration?: number; endCoordinates?: { height?: number; screenY?: number } }
    ) => {
      const duration = Math.min(Math.max(event?.duration ?? 220, 160), 280);
      const screenY = event?.endCoordinates?.screenY;
      const eventHeight = event?.endCoordinates?.height ?? 0;
      const measuredOffset =
        typeof screenY === 'number' ? Math.max(0, windowHeight - screenY) : eventHeight;
      const easing = Easing.bezier(0.2, 0.8, 0.2, 1);

      keyboardProgress.value = withTiming(visible ? 1 : 0, { duration, easing });
      if (visible) {
        keyboardOffset.value = withTiming(measuredOffset, { duration, easing });
      } else {
        keyboardOffset.value = withTiming(0, { duration, easing });
      }
      onKeyboardVisibleChange(visible);
    },
    [keyboardOffset, keyboardProgress, onKeyboardVisibleChange, windowHeight]
  );

  React.useEffect(() => {
    const handleShow = (event: {
      duration?: number;
      endCoordinates?: { height?: number; screenY?: number };
    }) => animateKeyboard(true, event);
    const handleHide = (event: {
      duration?: number;
      endCoordinates?: { height?: number; screenY?: number };
    }) => animateKeyboard(false, event);
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

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardOffset.value }],
  }));

  const detachedPlusStyle = useAnimatedStyle(() => {
    const progress = splitProgress.value;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [0.72, 0.72, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress, [0, 1], [0.8, 1], Extrapolation.CLAMP) }],
      width: interpolate(progress, [0, 1], [0, DETACHED_PLUS_SIZE], Extrapolation.CLAMP),
      marginRight: interpolate(progress, [0, 1], [0, COMPOSER_OPEN_GAP], Extrapolation.CLAMP),
    };
  });

  const embeddedPlusStyle = useAnimatedStyle(() => {
    const progress = splitProgress.value;
    return {
      opacity: interpolate(progress, [0, 0.7, 1], [1, 0.2, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress, [0, 1], [1, 0.7], Extrapolation.CLAMP) }],
      width: interpolate(progress, [0, 1], [38, 0], Extrapolation.CLAMP),
    };
  });

  const detachedPlusIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(voiceProgress.value, [0, 0.58], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        rotate: `${interpolate(voiceProgress.value, [0, 1], [0, -90], Extrapolation.CLAMP)}deg`,
      },
      { scale: interpolate(voiceProgress.value, [0, 1], [1, 0.62], Extrapolation.CLAMP) },
    ],
  }));

  const cancelIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(voiceProgress.value, [0.35, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        rotate: `${interpolate(voiceProgress.value, [0, 1], [90, 0], Extrapolation.CLAMP)}deg`,
      },
      { scale: interpolate(voiceProgress.value, [0, 1], [0.7, 1], Extrapolation.CLAMP) },
    ],
  }));

  const mainBarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(voiceProgress.value, [0, 1], [0, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const textInputLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(voiceProgress.value, [0, 0.72], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(voiceProgress.value, [0, 1], [0, -8], Extrapolation.CLAMP),
      },
      {
        translateY: interpolate(voiceProgress.value, [0, 1], [0, 4], Extrapolation.CLAMP),
      },
    ],
  }));

  const micButtonStyle = useAnimatedStyle(() => ({
    opacity: hasText && !voiceActive ? 0 : 1,
    transform: [{ scale: hasText && !voiceActive ? 0.82 : 1 }],
    width: hasText && !voiceActive ? 0 : 38,
    marginRight: hasText && !voiceActive ? 0 : 6,
  }));

  const normalSendStyle = useAnimatedStyle(() => ({
    opacity: 1,
    transform: [{ scale: 1 }],
    width: 44,
    marginLeft: 8,
  }));

  const waveformLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(voiceProgress.value, [0.2, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scaleX: interpolate(voiceProgress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) },
    ],
  }));

  React.useEffect(() => {
    const active = voiceState !== 'idle';
    voiceProgress.value = withTiming(active ? 1 : 0, {
      duration: active ? 250 : 220,
      easing: Easing.out(Easing.cubic),
    });
    if (!active) {
      waveformSamples.value = makeWaveformSamples(waveformSampleCountRef.current);
    }
  }, [voiceProgress, voiceState, waveformSamples]);

  const bottomPadding = keyboardVisible
    ? COMPOSER_BOTTOM_GAP_FOCUSED
    : Math.max(insets.bottom + COMPOSER_BOTTOM_GAP, 24);

  const resetRecordingLevel = React.useCallback(() => {
    recordingLevel.value = withTiming(0, { duration: 140 });
    waveformSamples.value = makeWaveformSamples(waveformSampleCountRef.current);
  }, [recordingLevel, waveformSamples]);

  const handleWaveformSampleCountChange = React.useCallback(
    (nextCount: number) => {
      if (waveformSampleCountRef.current === nextCount) return;
      waveformSampleCountRef.current = nextCount;
      waveformSamples.value = resizeWaveformSamples(waveformSamples.value, nextCount);
      setWaveformSampleCount(nextCount);
    },
    [waveformSamples]
  );

  function setFocusState(focused: boolean) {
    isFocusedRef.current = focused;
    if (focused) {
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
  }

  async function startVoiceRecording() {
    if (disabled || voiceState !== 'idle' || hasText) return;
    try {
      if (!speechToText.isReady) {
        if (speechToText.error) {
          void speechToText.retry();
        }
        onVoiceError(
          speechToText.error?.message ??
            `Voice transcription model is loading${speechToText.downloadProgress > 0 ? ` (${Math.round(speechToText.downloadProgress * 100)}%)` : ''}.`
        );
        return;
      }
      if (!voiceActivity.isReady) {
        if (voiceActivity.error) {
          void voiceActivity.retry();
        }
        onVoiceError(
          voiceActivity.error?.message ??
            `Voice activity model is loading${voiceActivity.downloadProgress > 0 ? ` (${Math.round(voiceActivity.downloadProgress * 100)}%)` : ''}.`
        );
        return;
      }
      const recordingSession = voiceRecordingSessionRef.current + 1;
      voiceRecordingSessionRef.current = recordingSession;
      await SpeechRecordingService.start((level) => {
        if (
          voiceRecordingSessionRef.current !== recordingSession ||
          voiceStateRef.current !== 'recording'
        ) {
          return;
        }
        const finiteLevel = Number.isFinite(level) ? level : 0;
        const clampedLevel = Math.max(0, Math.min(1, finiteLevel));
        const nextLevel = motionEnabled ? Math.max(0.08, clampedLevel) : 0.32;
        recordingLevel.value = withTiming(nextLevel, {
          duration: motionEnabled ? 100 : 0,
          easing: Easing.out(Easing.quad),
        });
        waveformSamples.value = [...waveformSamples.value.slice(1), nextLevel];
      });
      voiceStateRef.current = 'recording';
      setVoiceState('recording');
      voiceTimeoutRef.current = setTimeout(() => {
        void stopVoiceRecording();
      }, 45000);
    } catch (voiceError) {
      voiceRecordingSessionRef.current += 1;
      await SpeechRecordingService.cancel();
      voiceStateRef.current = 'idle';
      resetRecordingLevel();
      setVoiceState('idle');
      onVoiceError(
        voiceError instanceof Error ? voiceError.message : 'Unable to start voice input.'
      );
    }
  }

  async function stopVoiceRecording(options?: { submit?: boolean }) {
    if (voiceStateRef.current !== 'recording') return;
    voiceRecordingSessionRef.current += 1;
    voiceStateRef.current = 'transcribing';
    setVoiceState('transcribing');
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
    try {
      const waveform = await SpeechRecordingService.stop();
      if (!waveform.length) throw new Error('No voice recording was captured.');
      const speechSegments = await voiceActivity.forward(waveform);
      const speechWaveform =
        sliceVoiceActivity(waveform, speechSegments) ?? fallbackSpeechWaveform(waveform);
      if (!speechWaveform) throw new Error('No speech was detected in the recording.');
      const transcript = await speechToText.transcribe(speechWaveform, {});
      const transcriptText = transcript.text.trim();
      if (!transcriptText) throw new Error('No speech was detected in the recording.');
      if (options?.submit) {
        onChangeText('');
        onSubmit(transcriptText);
      } else {
        onChangeText(transcriptText);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    } catch (voiceError) {
      onVoiceError(
        voiceError instanceof Error ? voiceError.message : 'Unable to transcribe voice input.'
      );
    } finally {
      voiceStateRef.current = 'idle';
      resetRecordingLevel();
      setVoiceState('idle');
    }
  }

  async function cancelVoiceRecording() {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
    voiceRecordingSessionRef.current += 1;
    await SpeechRecordingService.cancel();
    voiceStateRef.current = 'idle';
    resetRecordingLevel();
    setVoiceState('idle');
  }

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
              style={[
                styles.promptChip,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}>
              <Text variant="small">{prompt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {errorMessage ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDismissError}
          style={[
            styles.composerError,
            { borderColor: colors.notification, backgroundColor: colors.card },
          ]}>
          <Text className="text-destructive text-sm" numberOfLines={3}>
            {errorMessage}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.composerRow}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={voiceActive ? 'Cancel voice input' : 'Add context'}
          disabled={!voiceActive && !keyboardVisible}
          onPress={() => {
            if (voiceActive) {
              void cancelVoiceRecording();
            } else {
              onAddContextPress();
            }
          }}
          style={[
            styles.detachedPlusButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            detachedPlusStyle,
          ]}>
          <Animated.View style={[styles.detachedIconLayer, detachedPlusIconStyle]}>
            <Icon as={Plus} className="text-foreground size-5" />
          </Animated.View>
          <Animated.View style={[styles.detachedIconLayer, cancelIconStyle]}>
            <Icon as={CircleX} className="text-foreground size-5" />
          </Animated.View>
        </AnimatedPressable>

        <Animated.View
          style={[
            styles.inputPill,
            {
              alignItems: 'stretch',
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: 28,
              minHeight: inputHeight,
            },
            mainBarStyle,
          ]}>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={onAddContextPress}
            style={[styles.embeddedPlus, embeddedPlusStyle]}>
            <Icon as={Plus} className="text-foreground size-5" />
          </AnimatedPressable>

          <View style={styles.inputStage}>
            <Animated.View
              pointerEvents={voiceActive ? 'none' : 'auto'}
              style={[styles.textInputLayer, textInputLayerStyle]}>
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={onChangeText}
                onFocus={() => setFocusState(true)}
                onBlur={() => setFocusState(false)}
                onContentSizeChange={(event) => {
                  const nextHeight = Math.min(
                    COMPOSER_MAX_INPUT_HEIGHT,
                    Math.max(COMPOSER_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height + 4))
                  );
                  setInputHeight(nextHeight);
                }}
                placeholder="Ask Arky"
                placeholderTextColor={themeColors.mutedForeground}
                returnKeyType="default"
                editable={!voiceActive}
                multiline
                blurOnSubmit={false}
                scrollEnabled={inputHeight >= COMPOSER_MAX_INPUT_HEIGHT}
                style={[
                  styles.composerInput,
                  {
                    color: colors.text,
                    paddingBottom: 14,
                    paddingTop: 14,
                  },
                ]}
                textAlignVertical="top"
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.waveformLayer, waveformLayerStyle]}>
              <VoiceWaveform
                color={colors.primary}
                sampleCount={waveformSampleCount}
                samples={waveformSamples}
                onSampleCountChange={handleWaveformSampleCountChange}
              />
            </Animated.View>
          </View>

          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={voiceActive ? 'Stop voice input' : 'Start voice input'}
            disabled={
              disabled ||
              voiceState === 'transcribing' ||
              (!voiceActive && hasText)
            }
            onPress={() => {
              if (voiceState === 'recording') {
                void stopVoiceRecording();
              } else if (!voiceActive) {
                void startVoiceRecording();
              }
            }}
            style={[styles.micButton, micButtonStyle]}>
            {voiceState === 'transcribing' ? (
              <ActivityIndicator size="small" />
            ) : voiceActive ? (
              <Icon as={Square} className="text-primary size-5" />
            ) : (
              <Icon as={Mic} className="text-muted-foreground size-5" />
            )}
          </AnimatedPressable>

          <AnimatedPressable
            accessibilityRole="button"
            disabled={disabled || (!value.trim() && !voiceActive)}
            onPress={() => {
              if (voiceState === 'recording') {
                void stopVoiceRecording({ submit: true });
              } else if (!voiceActive) {
                onSubmit();
              }
            }}
            style={[
              styles.voiceButton,
              normalSendStyle,
              {
                backgroundColor: colors.primary,
                opacity: disabled || (!value.trim() && !voiceActive) ? 0.54 : 1,
              },
            ]}>
            {disabled || voiceState === 'transcribing' ? (
              <ActivityIndicator color={colors.primary === '#F2B84B' ? '#0A0A0A' : '#FFFFFF'} />
            ) : (
              <Icon
                as={Send}
                color={colors.primary === '#F2B84B' ? '#0A0A0A' : '#FFFFFF'}
                size={19}
              />
            )}
          </AnimatedPressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function VoiceWaveform({
  color,
  onSampleCountChange,
  sampleCount,
  samples,
}: {
  color: string;
  onSampleCountChange: (count: number) => void;
  sampleCount: number;
  samples: SharedValue<number[]>;
}) {
  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (!Number.isFinite(width) || width <= 0) return;
      const nextCount = Math.max(
        WAVEFORM_MIN_SAMPLES,
        Math.min(WAVEFORM_MAX_SAMPLES, Math.floor(width / WAVEFORM_TARGET_STEP))
      );
      onSampleCountChange(nextCount);
    },
    [onSampleCountChange]
  );

  return (
    <View style={styles.waveformTrack} onLayout={handleLayout}>
      {Array.from({ length: sampleCount }).map((_, index) => (
        <WaveformBar
          key={index}
          color={color}
          index={index}
          samples={samples}
        />
      ))}
    </View>
  );
}

function WaveformBar({
  color,
  index,
  samples,
}: {
  color: string;
  index: number;
  samples: SharedValue<number[]>;
}) {
  const barStyle = useAnimatedStyle(() => {
    const sample = samples.value[index] ?? 0.12;
    const neighbor = samples.value[index + 1] ?? sample;
    const mixedLevel = Math.max(0.08, sample * 0.82 + neighbor * 0.18);
    const baseHeight = 7 + (index % 4) * 2;
    const height = baseHeight + mixedLevel * (index % 3 === 0 ? 22 : 15);

    return {
      height,
      opacity: 0.42 + Math.min(0.5, mixedLevel * 0.55),
      transform: [{ scaleY: 0.92 + Math.min(0.22, mixedLevel * 0.18) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        {
          backgroundColor: color,
          width: index % 5 === 0 ? 4 : WAVEFORM_BAR_WIDTH,
        },
        barStyle,
      ]}
    />
  );
}

function sliceVoiceActivity(
  waveform: Float32Array,
  segments: Array<{ start: number; end: number }>
) {
  const sampleRate = 16000;
  const usableSegments = segments.filter(
    (segment) => segment.end - segment.start >= 0.18 * sampleRate
  );
  if (!usableSegments.length) return null;
  const first = usableSegments[0];
  const last = usableSegments[usableSegments.length - 1];
  const start = Math.max(0, Math.floor(first.start - 0.2 * sampleRate));
  const end = Math.min(waveform.length, Math.ceil(last.end + 0.35 * sampleRate));
  if (end <= start) return null;
  return waveform.slice(start, end);
}

function fallbackSpeechWaveform(waveform: Float32Array) {
  const sampleRate = 16000;
  const frameSize = Math.round(sampleRate * 0.05);
  const minimumDuration = Math.round(sampleRate * 0.24);
  if (waveform.length < minimumDuration) return null;

  let peak = 0;
  let sumSquares = 0;
  for (let index = 0; index < waveform.length; index += 1) {
    const magnitude = Math.abs(waveform[index] ?? 0);
    peak = Math.max(peak, magnitude);
    sumSquares += magnitude * magnitude;
  }
  const rms = Math.sqrt(sumSquares / waveform.length);
  if (peak < 0.025 && rms < 0.004) return null;

  let firstFrame = -1;
  let lastFrame = -1;
  for (let offset = 0, frameIndex = 0; offset < waveform.length; offset += frameSize, frameIndex += 1) {
    const frameEnd = Math.min(waveform.length, offset + frameSize);
    let frameSquares = 0;
    for (let sampleIndex = offset; sampleIndex < frameEnd; sampleIndex += 1) {
      const sample = waveform[sampleIndex] ?? 0;
      frameSquares += sample * sample;
    }
    const frameRms = Math.sqrt(frameSquares / Math.max(1, frameEnd - offset));
    if (frameRms >= 0.006) {
      if (firstFrame < 0) firstFrame = frameIndex;
      lastFrame = frameIndex;
    }
  }

  if (firstFrame < 0 || lastFrame < 0) {
    return waveform;
  }

  const start = Math.max(0, firstFrame * frameSize - Math.round(sampleRate * 0.18));
  const end = Math.min(waveform.length, (lastFrame + 1) * frameSize + Math.round(sampleRate * 0.28));
  if (end - start < minimumDuration) return null;
  return waveform.slice(start, end);
}

export default function ChatScreen() {
  const { threadId: routeThreadId } = useLocalSearchParams<{ threadId?: string }>();
  const insets = useSafeAreaInsets();
  const reduceModeEnabled = useBatteryReduceMode();
  const speechPlayback = useArkTextToSpeech();
  const initialThreadId = routeThreadId && routeThreadId !== 'new' ? routeThreadId : undefined;
  const [threadId, setThreadId] = React.useState<string | undefined>(initialThreadId);
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [modelDisabled, setModelDisabled] = React.useState(false);
  const [modelInfoOpen, setModelInfoOpen] = React.useState(false);
  const [contextSheetOpen, setContextSheetOpen] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = React.useState<AiMessage | null>(null);
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
    setInstalledModels(models);
    if (!threadId && modelChoiceDirtyRef.current) return;
    setActiveModel(nextModel);
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

  async function send(textOverride?: string) {
    const trimmed = (textOverride ?? content).trim();
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
      const sendMessagePromise = AIService.sendMessage(
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
      const result = await sendMessagePromise;
      setThreadId(result.threadId);
      setPendingUserMessage(null);
      setMessages((current) => [...current, ...result.messages]);
      scrollToBottom(true);
      if (!threadId) {
        router.replace(`/chat/${result.threadId}` as never);
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
    setModelDisabled(true);
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
          onSpeakAssistant={speakAssistantMessage}
          speaking={speakingMessageId === item.item.message.id}
          speechStatusLabel={
            speakingMessageId === item.item.message.id && !speechPlayback.isReady
              ? `Loading voice ${Math.round(speechPlayback.downloadProgress * 100)}%`
              : speakingMessageId === item.item.message.id &&
                  speechPlayback.isGenerating &&
                  !speechPlayback.isPlaying
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
      speechPlayback.isGenerating,
      speechPlayback.isPlaying,
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

      <FloatingComposer
        value={content}
        disabled={sending}
        errorMessage={error}
        keyboardVisible={keyboardVisible}
        showPrompts={emptyThread && !keyboardVisible}
        onChangeText={setContent}
        onDismissError={() => setError(null)}
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
          onPress={() => {
            setContextSheetOpen(false);
            router.push('/(tabs)/library' as never);
          }}>
          <Icon as={BookOpen} className="size-4" />
          <Text>Library</Text>
        </Button>
        <Button
          variant="ghost"
          className="h-11 justify-start px-2"
          onPress={() => {
            setContextSheetOpen(false);
            router.push('/(tabs)/notes' as never);
          }}>
          <Icon as={NotebookPen} className="size-4" />
          <Text>Notes</Text>
        </Button>
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
    lineHeight: 20,
    maxHeight: COMPOSER_MAX_INPUT_HEIGHT,
    minHeight: COMPOSER_HEIGHT,
    paddingBottom: 0,
    paddingHorizontal: 2,
    paddingTop: 0,
  },
  composerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  detachedPlusButton: {
    alignItems: 'center',
    borderRadius: DETACHED_PLUS_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    height: DETACHED_PLUS_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  detachedIconLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  embeddedPlus: {
    alignItems: 'center',
    alignSelf: 'center',
    height: COMPOSER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inputPill: {
    borderRadius: COMPOSER_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    maxHeight: COMPOSER_MAX_INPUT_HEIGHT,
    minWidth: 0,
    minHeight: COMPOSER_HEIGHT,
    overflow: 'hidden',
    paddingLeft: 10,
    paddingRight: 8,
  },
  inputStage: {
    flex: 1,
    minHeight: COMPOSER_HEIGHT,
    minWidth: 0,
    position: 'relative',
  },
  textInputLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  waveformLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingRight: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  waveformTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    height: COMPOSER_HEIGHT,
    justifyContent: 'space-between',
    overflow: 'hidden',
    width: '100%',
  },
  waveformBar: {
    borderRadius: 999,
    minHeight: 5,
  },
  micButton: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 42,
    justifyContent: 'center',
    marginRight: 4,
    position: 'relative',
    width: 36,
  },
  composerError: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    alignSelf: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
