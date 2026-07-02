import {
  getSpeechPlaybackContext,
  getSpeechSampleRate,
  suspendSpeechPlaybackContext,
} from '@/services/audio/speech-playback.service';
import { VoiceRuntimeService } from '@/services/ai/voice-runtime.service';
import { TextToSpeechModule } from 'react-native-executorch';
import * as React from 'react';

type PlaybackSource = {
  stop: (when?: number) => void;
  onEnded?: () => void;
};

export function useArkTextToSpeech() {
  const moduleRef = React.useRef<TextToSpeechModule | null>(null);
  const sourceRef = React.useRef<PlaybackSource | null>(null);
  const playbackResolveRef = React.useRef<(() => void) | null>(null);
  const streamActiveRef = React.useRef(false);
  const runIdRef = React.useRef(0);
  const [error, setError] = React.useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const [isReady, setIsReady] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);

  const stop = React.useCallback(() => {
    runIdRef.current += 1;
    try {
      sourceRef.current?.stop(0);
    } catch {
      // The source may already have ended between the button press and this call.
    }
    sourceRef.current = null;
    playbackResolveRef.current?.();
    playbackResolveRef.current = null;
    if (streamActiveRef.current) {
      moduleRef.current?.streamStop(true);
      streamActiveRef.current = false;
    }
    void suspendSpeechPlaybackContext();
    setIsPlaying(false);
    setIsGenerating(false);
  }, []);

  const getModule = React.useCallback(async () => {
    if (moduleRef.current) return moduleRef.current;
    setError(null);
    const moduleInstance = await VoiceRuntimeService.loadTextToSpeech().catch((loadError) => {
      const nextError =
        loadError instanceof Error ? loadError : new Error('Unable to load voice playback.');
      setError(nextError);
      throw nextError;
    });
    moduleRef.current = moduleInstance;
    setIsReady(true);
    setDownloadProgress(1);
    return moduleInstance;
  }, []);

  const speak = React.useCallback(
    async (text: string) => {
      const normalized = normalizeSpeechText(text);
      if (!normalized) return;

      stop();
      const runId = runIdRef.current;
      setError(null);
      setIsGenerating(true);
      try {
        const moduleInstance = await getModule();
        if (runIdRef.current !== runId) return;

        moduleInstance.streamInsert(
          normalized + ('.?!;'.includes(normalized.slice(-1)) ? '' : '.')
        );
        streamActiveRef.current = true;
        let producedAudio = false;
        for await (const waveform of moduleInstance.stream({
          speed: 1,
          phonemize: true,
          stopAutomatically: true,
        })) {
          if (runIdRef.current !== runId) break;
          producedAudio = true;
          setIsPlaying(true);
          await playWaveform(waveform, sourceRef, playbackResolveRef);
        }
        if (!producedAudio && runIdRef.current === runId) {
          throw new Error('Voice playback produced no audio.');
        }
      } catch (error) {
        sourceRef.current = null;
        setError(error instanceof Error ? error : new Error('Unable to play voice output.'));
        throw error;
      } finally {
        streamActiveRef.current = false;
        if (runIdRef.current === runId) {
          setIsPlaying(false);
          setIsGenerating(false);
          void suspendSpeechPlaybackContext();
        }
      }
    },
    [getModule, stop]
  );

  React.useEffect(
    () => () => {
      stop();
      moduleRef.current = null;
    },
    [stop]
  );

  React.useEffect(() => {
    const unsubscribe = VoiceRuntimeService.subscribeTextToSpeechProgress(setDownloadProgress);
    const existingModule = VoiceRuntimeService.getTextToSpeechModule();
    if (existingModule) {
      moduleRef.current = existingModule;
      setIsReady(true);
      setDownloadProgress(1);
    } else {
      setError(VoiceRuntimeService.getTextToSpeechError());
    }
    return unsubscribe;
  }, []);

  const isPreparing = isGenerating && !isPlaying;

  return {
    error,
    isReady,
    isGenerating,
    isPreparing,
    downloadProgress,
    isPlaying,
    speak,
    stop,
  };
}

function normalizeSpeechText(text: string) {
  return text
    .replace(/\[[0-9]+\]/g, '')
    .replace(/```[\s\S]*?```/g, ' code block omitted. ')
    .replace(/[#*_>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2800);
}

async function playWaveform(
  waveform: Float32Array,
  sourceRef: React.MutableRefObject<PlaybackSource | null>,
  playbackResolveRef: React.MutableRefObject<(() => void) | null>
) {
  if (!waveform.length) return;
  const sampleRate = getSpeechSampleRate();
  const context = getSpeechPlaybackContext();
  await context.resume().catch(() => undefined);
  const buffer = context.createBuffer(1, waveform.length, sampleRate);
  buffer.getChannelData(0).set(waveform);

  const source = context.createBufferSource() as PlaybackSource & {
    buffer: typeof buffer | null;
    connect: (destination: unknown) => void;
    start: (when?: number) => void;
  };
  source.buffer = buffer;
  source.connect(context.destination);
  sourceRef.current = source;
  await new Promise<void>((resolve) => {
    playbackResolveRef.current = resolve;
    source.onEnded = () => {
      if (sourceRef.current === source) sourceRef.current = null;
      playbackResolveRef.current = null;
      resolve();
    };
    source.start(0);
  });
}
