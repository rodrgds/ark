import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useArkSpeechToText } from '@/hooks/use-ark-speech-to-text';
import { useArkVoiceActivity } from '@/hooks/use-ark-voice-activity';
import { useMotionEnabled } from '@/hooks/use-motion-enabled';
import { SpeechRecordingService } from '@/services/audio/speech-recording.service';
import { useThemeStore } from '@/stores/theme-store';
import type { AiAttachment } from '@/types/ai';
import {
  CircleX,
  FileText,
  Image as ImageIcon,
  Mic,
  NotebookPen,
  Plus,
  Send,
  Square,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Keyboard,
  type LayoutChangeEvent,
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

const COMPOSER_HEIGHT = 56;
const COMPOSER_MAX_INPUT_HEIGHT = 132;
const DETACHED_PLUS_SIZE = COMPOSER_HEIGHT;
const COMPOSER_SIDE_PADDING = 12;
const COMPOSER_OPEN_GAP = 10;
const COMPOSER_BOTTOM_GAP = 14;
const COMPOSER_BOTTOM_GAP_FOCUSED = 4;
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
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ChatInputAttachment = AiAttachment & {
  localId: string;
};

function makeWaveformSamples(count: number) {
  return Array.from({ length: count }, () => 0.12);
}

function resizeWaveformSamples(samples: number[], count: number) {
  if (samples.length === count) return samples;
  if (samples.length > count) return samples.slice(samples.length - count);
  return [...makeWaveformSamples(count - samples.length), ...samples];
}

export function ChatInput({
  value,
  disabled,
  errorMessage,
  attachments,
  keyboardVisible,
  showPrompts,
  onChangeText,
  onDismissError,
  onRemoveAttachment,
  onVoiceError,
  onKeyboardVisibleChange,
  onAddContextPress,
  onPromptPress,
  onSubmit,
}: {
  value: string;
  disabled: boolean;
  errorMessage?: string | null;
  attachments: ChatInputAttachment[];
  keyboardVisible: boolean;
  showPrompts: boolean;
  onChangeText: (text: string) => void;
  onDismissError: () => void;
  onRemoveAttachment: (id: string) => void;
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
  const colors = useThemeStore((state) => state.colors);
  const [voiceState, setVoiceState] = React.useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [inputHeight, setInputHeight] = React.useState(COMPOSER_HEIGHT);
  const [waveformSampleCount, setWaveformSampleCount] = React.useState(WAVEFORM_INITIAL_SAMPLES);
  const keyboardProgress = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const voiceProgress = useSharedValue(0);
  const recordingLevel = useSharedValue(0);
  const waveformSamples = useSharedValue(makeWaveformSamples(WAVEFORM_INITIAL_SAMPLES));
  const hasText = value.length > 0;
  const hasAttachments = attachments.length > 0;
  const voiceActive = voiceState !== 'idle';
  const inputExpanded = inputHeight > COMPOSER_HEIGHT;
  const isFocusedRef = React.useRef(false);
  const splitProgress = useDerivedValue(() =>
    Math.max(keyboardProgress.value, voiceProgress.value)
  );

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
            { borderColor: colors.destructive, backgroundColor: colors.card },
          ]}>
          <Text className="text-destructive text-sm" numberOfLines={3}>
            {errorMessage}
          </Text>
        </Pressable>
      ) : null}

      {hasAttachments ? (
        <View style={styles.attachmentTray}>
          {attachments.map((attachment) => (
            <Pressable
              key={attachment.localId}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${attachment.title}`}
              onPress={() => onRemoveAttachment(attachment.localId)}
              style={[
                styles.attachmentChip,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}>
              <Icon
                as={
                  attachment.type === 'image'
                    ? ImageIcon
                    : attachment.type === 'note'
                      ? NotebookPen
                      : FileText
                }
                className="text-primary size-3.5"
              />
              <Text variant="small" numberOfLines={1} className="max-w-[190px]">
                {attachment.title}
              </Text>
              <Icon as={X} className="text-muted-foreground size-3.5" />
            </Pressable>
          ))}
        </View>
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
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="default"
                editable={!voiceActive}
                multiline
                blurOnSubmit={false}
                scrollEnabled={inputHeight >= COMPOSER_MAX_INPUT_HEIGHT}
                style={[
                  styles.composerInput,
                  {
                    color: colors.foreground,
                    paddingBottom: inputExpanded ? 14 : 0,
                    paddingTop: inputExpanded ? 14 : 0,
                  },
                ]}
                textAlignVertical={inputExpanded ? 'top' : 'center'}
              />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.waveformLayer, waveformLayerStyle]}>
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
            disabled={disabled || voiceState === 'transcribing' || (!voiceActive && hasText)}
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
            disabled={disabled || (!value.trim() && !voiceActive && !hasAttachments)}
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
                opacity: disabled || (!value.trim() && !voiceActive && !hasAttachments) ? 0.54 : 1,
              },
            ]}>
            {disabled || voiceState === 'transcribing' ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Icon as={Send} color={colors.primaryForeground} size={19} />
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
        <WaveformBar key={index} color={color} index={index} samples={samples} />
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
  for (
    let offset = 0, frameIndex = 0;
    offset < waveform.length;
    offset += frameSize, frameIndex += 1
  ) {
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
  const end = Math.min(
    waveform.length,
    (lastFrame + 1) * frameSize + Math.round(sampleRate * 0.28)
  );
  if (end - start < minimumDuration) return null;
  return waveform.slice(start, end);
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
  attachmentTray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  attachmentChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
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
