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
import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import { NAV_THEME } from '@/lib/theme';
import { AIService, isAiRequestCancelledError } from '@/services/ai/ai.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';
import { VoiceTranscriptionService } from '@/services/ai/voice-transcription.service';
import { useThemeStore } from '@/stores/theme-store';
import type { AiCitation, AiMessage, AiProgressEvent } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
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
  Square,
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
const COMPOSER_MAX_INPUT_HEIGHT = 132;
const DETACHED_PLUS_SIZE = 48;
const COMPOSER_SIDE_PADDING = 12;
const COMPOSER_OPEN_GAP = 10;
const COMPOSER_BOTTOM_GAP = 14;
const COMPOSER_BOTTOM_GAP_FOCUSED = 4;
const MESSAGE_LIST_BOTTOM_PADDING = 168;
const EMPTY_THREAD_PROMPTS = [
  'Create a survival checklist for tonight',
  'Write or edit a field note',
  'Look up water purification guidance',
];
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const VOICE_RECORDING_OPTIONS: RecordingOptions = Platform.select({
  ios: {
    extension: '.wav',
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    android: RecordingPresets.HIGH_QUALITY.android,
    ios: {
      outputFormat: IOSOutputFormat.LINEARPCM,
      audioQuality: AudioQuality.MAX,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/wav',
      bitsPerSecond: 256000,
    },
  },
  default: RecordingPresets.HIGH_QUALITY,
});

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

type TraceAction = {
  summary: string;
  tool?: string;
  active?: boolean;
};

function ProcessPanel({
  messageId,
  actions,
  reasoning,
  citations = [],
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
                  <View key={`${action.summary}-${index}`} className="flex-row items-start gap-2">
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
  errorMessage,
  voiceReady,
  voiceStatusMessage,
  keyboardVisible,
  showPrompts,
  onChangeText,
  onDismissError,
  onVoiceError,
  onKeyboardVisibleChange,
  onPromptPress,
  onSubmit,
}: {
  value: string;
  disabled: boolean;
  errorMessage?: string | null;
  voiceReady: boolean;
  voiceStatusMessage?: string;
  keyboardVisible: boolean;
  showPrompts: boolean;
  onChangeText: (text: string) => void;
  onDismissError: () => void;
  onVoiceError: (message: string) => void;
  onKeyboardVisibleChange: (visible: boolean) => void;
  onPromptPress: (prompt: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = React.useRef<TextInput>(null);
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;
  const [isFocused, setIsFocused] = React.useState(false);
  const [voiceState, setVoiceState] = React.useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [inputHeight, setInputHeight] = React.useState(COMPOSER_HEIGHT);
  const keyboardProgress = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const hasText = value.length > 0;
  const expanded = inputHeight > COMPOSER_HEIGHT + 8;

  const calculateKeyboardOffset = React.useCallback(
    (
      event: { endCoordinates?: { height?: number; screenY?: number } } | undefined,
      fallbackOffset: number
    ) => {
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
    [
      calculateKeyboardOffset,
      keyboardOffset,
      keyboardProgress,
      onKeyboardVisibleChange,
      windowHeight,
    ]
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
      width: interpolate(progress, [0, 1], [0, DETACHED_PLUS_SIZE], Extrapolation.CLAMP),
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

  const bottomPadding = keyboardVisible
    ? COMPOSER_BOTTOM_GAP_FOCUSED
    : Math.max(insets.bottom + COMPOSER_BOTTOM_GAP, 24);

  async function startVoiceRecording() {
    if (disabled || voiceState !== 'idle' || hasText) return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onVoiceError('Microphone permission is required for voice input.');
        return;
      }
      if (Platform.OS === 'android') {
        setVoiceState('transcribing');
        const transcript = await VoiceTranscriptionService.transcribeWithAndroidSpeech();
        onChangeText(transcript);
        requestAnimationFrame(() => inputRef.current?.focus());
        setVoiceState('idle');
        return;
      }
      if (!voiceReady) {
        onVoiceError(
          voiceStatusMessage ?? 'Download a voice model in Settings > AI before using voice input.'
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync(VOICE_RECORDING_OPTIONS);
      recorder.record({ forDuration: 45 });
      setVoiceState('recording');
    } catch (voiceError) {
      setVoiceState('idle');
      onVoiceError(
        voiceError instanceof Error ? voiceError.message : 'Unable to start voice input.'
      );
    }
  }

  async function stopVoiceRecording() {
    if (voiceState !== 'recording') return;
    setVoiceState('transcribing');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri ?? recorderState.url;
      if (!uri) throw new Error('No voice recording was saved.');
      const transcript = await VoiceTranscriptionService.transcribeAudio(uri);
      onChangeText(transcript);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (voiceError) {
      onVoiceError(
        voiceError instanceof Error ? voiceError.message : 'Unable to transcribe voice input.'
      );
    } finally {
      setVoiceState('idle');
    }
  }

  React.useEffect(() => {
    if (voiceState === 'recording' && !recorderState.isRecording && recorderState.url) {
      void stopVoiceRecording();
    }
  }, [recorderState.isRecording, recorderState.url, voiceState]);

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
          disabled={!keyboardVisible}
          onPress={() => undefined}
          style={[styles.detachedPlusButton, detachedPlusStyle]}>
          <Icon as={Plus} className="text-foreground size-5" />
        </AnimatedPressable>

        <Animated.View
          style={[
            styles.inputPill,
            {
              alignItems: expanded ? 'flex-end' : 'center',
              borderRadius: expanded ? 28 : COMPOSER_HEIGHT / 2,
              minHeight: inputHeight,
            },
          ]}>
          <Animated.View style={[styles.embeddedPlus, embeddedPlusStyle]}>
            <Icon as={Plus} className="text-foreground size-5" />
          </Animated.View>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onContentSizeChange={(event) => {
              const nextHeight = Math.min(
                COMPOSER_MAX_INPUT_HEIGHT,
                Math.max(COMPOSER_HEIGHT, event.nativeEvent.contentSize.height + 16)
              );
              setInputHeight(nextHeight);
            }}
            placeholder="Ask Arky"
            placeholderTextColor="#9CA3AF"
            returnKeyType="default"
            editable={true}
            multiline
            blurOnSubmit={false}
            scrollEnabled={inputHeight >= COMPOSER_MAX_INPUT_HEIGHT}
            style={[
              styles.composerInput,
              {
                color: colors.text,
                height: inputHeight,
                paddingBottom: expanded ? 14 : 0,
                paddingTop: expanded ? 14 : 0,
              },
            ]}
            textAlignVertical={expanded ? 'top' : 'center'}
          />
          {!hasText ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled || voiceState === 'transcribing'}
              onPress={() =>
                voiceState === 'recording' ? void stopVoiceRecording() : void startVoiceRecording()
              }
              style={[styles.micButton, { marginBottom: expanded ? 7 : 0 }]}>
              {voiceState === 'transcribing' ? (
                <ActivityIndicator size="small" />
              ) : voiceState === 'recording' ? (
                <Icon as={Square} className="text-primary size-5" />
              ) : (
                <Icon as={Mic} className="text-muted-foreground size-5" />
              )}
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={disabled || !value.trim()}
            onPress={onSubmit}
            style={[
              styles.voiceButton,
              {
                backgroundColor: colors.primary,
                marginBottom: expanded ? 6 : 0,
                opacity: disabled || !value.trim() ? 0.54 : 1,
              },
            ]}>
            {disabled ? (
              <ActivityIndicator color={colors.primary === '#F2B84B' ? '#0A0A0A' : '#FFFFFF'} />
            ) : (
              <Icon
                as={Send}
                color={colors.primary === '#F2B84B' ? '#0A0A0A' : '#FFFFFF'}
                size={19}
              />
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
  const reduceModeEnabled = useBatteryReduceMode();
  const initialThreadId = routeThreadId && routeThreadId !== 'new' ? routeThreadId : undefined;
  const [threadId, setThreadId] = React.useState<string | undefined>(initialThreadId);
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [installedEmbeddingModels, setInstalledEmbeddingModels] = React.useState<ContentPack[]>([]);
  const [installedVoiceModels, setInstalledVoiceModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [modelDisabled, setModelDisabled] = React.useState(false);
  const [activeEmbeddingModel, setActiveEmbeddingModel] = React.useState<ContentPack | null>(null);
  const [activeVoiceModel, setActiveVoiceModel] = React.useState<ContentPack | null>(null);
  const [voiceStatus, setVoiceStatus] = React.useState<Awaited<
    ReturnType<typeof ModelManagerService.getVoiceStatus>
  > | null>(null);
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
  const flatListRef = React.useRef<FlatList>(null);

  const scrollToBottom = React.useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 60);
  }, []);

  const handleScroll = React.useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      if (offsetY <= 100 && !olderLoading && hasOlderMessages && messages.length > 0) {
        void loadOlderMessages();
      }
    },
    [olderLoading, hasOlderMessages, messages.length]
  );

  React.useEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [loading, scrollToBottom]);

  React.useEffect(() => {
    if (messages.length > 0 || sending) {
      scrollToBottom(true);
    }
  }, [messages.length, sending, scrollToBottom]);

  React.useEffect(() => {
    if (keyboardVisible) {
      scrollToBottom(true);
    }
  }, [keyboardVisible, scrollToBottom]);

  const refreshModels = React.useCallback(async () => {
    const [
      models,
      embeddingModels,
      voiceModels,
      globalModel,
      embeddingModel,
      voiceModel,
      nextVoiceStatus,
      preferences,
    ] = await Promise.all([
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.listInstalledEmbeddingModels(),
      ModelManagerService.listInstalledVoiceModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getActiveEmbeddingModel(),
      ModelManagerService.getActiveVoiceModel(),
      ModelManagerService.getVoiceStatus(),
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
    setInstalledEmbeddingModels(embeddingModels);
    setInstalledVoiceModels(voiceModels);
    setActiveModel(nextModel);
    setActiveEmbeddingModel(embeddingModel);
    setActiveVoiceModel(voiceModel);
    setVoiceStatus(nextVoiceStatus);
    setModelDisabled(nextDisabled);
  }, [threadId]);

  const refreshModelsQuietly = React.useCallback(() => {
    void refreshModels().catch((modelError) => {
      setError(modelError instanceof Error ? modelError.message : 'Unable to refresh AI models.');
    });
  }, [refreshModels]);

  async function load() {
    setLoading(true);
    const id = routeThreadId && routeThreadId !== 'new' ? routeThreadId : null;
    try {
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
    } finally {
      setLoading(false);
    }
    refreshModelsQuietly();
  }

  React.useEffect(() => {
    void load();
  }, [routeThreadId]);

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

  async function selectEmbeddingModel(model: ContentPack) {
    await ModelManagerService.setSelectedEmbeddingModel(model.id);
    setActiveEmbeddingModel(model);
  }

  async function selectVoiceModel(model: ContentPack) {
    await ModelManagerService.setSelectedVoiceModel(model.id);
    setActiveVoiceModel(model);
    setVoiceStatus(await ModelManagerService.getVoiceStatus());
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
        voiceReady={!!voiceStatus?.ready}
        voiceStatusMessage={voiceStatus?.message}
        keyboardVisible={keyboardVisible}
        showPrompts={emptyThread && !keyboardVisible}
        onChangeText={setContent}
        onDismissError={() => setError(null)}
        onVoiceError={setError}
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
        title="AI model settings"
        description="Choose answer, source search, and voice models."
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

        <View className="mt-4 gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={Search} className="text-primary size-5" />
            <Text variant="large">Source search model</Text>
          </View>
          <ModelChoice
            title="Ark hash fallback"
            description="Built-in deterministic source matching. No model download required."
            active={!activeEmbeddingModel}
            icon={Search}
            onPress={() =>
              void ModelManagerService.setSelectedEmbeddingModel(null).then(() =>
                setActiveEmbeddingModel(null)
              )
            }
          />
          {installedEmbeddingModels.map((model) => (
            <ModelChoice
              key={model.id}
              title={model.title}
              description={model.description ?? 'Installed local source-search model.'}
              active={activeEmbeddingModel?.id === model.id}
              icon={Search}
              onPress={() => void selectEmbeddingModel(model)}
            />
          ))}
          {!installedEmbeddingModels.length ? (
            <Text variant="muted" className="px-1 py-2">
              Download a source search model in Settings to improve local retrieval.
            </Text>
          ) : null}
        </View>

        <View className="mt-4 gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={Mic} className="text-primary size-5" />
            <Text variant="large">Voice AI</Text>
          </View>
          {installedVoiceModels.map((model) => (
            <ModelChoice
              key={model.id}
              title={model.title}
              description={model.description ?? 'Installed local voice transcription model.'}
              active={activeVoiceModel?.id === model.id}
              icon={Mic}
              onPress={() => void selectVoiceModel(model)}
            />
          ))}
          {!installedVoiceModels.length ? (
            <Text variant="muted" className="px-1 py-2">
              Download a voice model in Settings to dictate Ask Arky prompts offline.
            </Text>
          ) : null}
          {voiceStatus ? (
            <Text variant="muted" className="px-1">
              {voiceStatus.message}
            </Text>
          ) : null}
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
    alignItems: 'flex-end',
    flexDirection: 'row',
    width: '100%',
  },
  detachedPlusButton: {
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderColor: '#303030',
    borderRadius: DETACHED_PLUS_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    height: DETACHED_PLUS_SIZE,
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
    backgroundColor: '#1F1F1F',
    borderColor: '#303030',
    borderRadius: COMPOSER_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    maxHeight: COMPOSER_MAX_INPUT_HEIGHT,
    minWidth: 0,
    minHeight: COMPOSER_HEIGHT,
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
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
