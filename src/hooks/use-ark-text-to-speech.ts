import {
  models,
  TextToSpeechModule,
} from 'react-native-executorch';
import {
  getSpeechPlaybackContext,
  getSpeechSampleRate,
} from '@/services/audio/speech-playback.service';
import * as React from 'react';

type PlaybackSource = {
  stop: () => void;
  onEnded?: () => void;
};

const TTS_MODEL = models.text_to_speech.kokoro.en_us.heart();

export function useArkTextToSpeech() {
  const moduleRef = React.useRef<TextToSpeechModule | null>(null);
  const modulePromiseRef = React.useRef<Promise<TextToSpeechModule> | null>(null);
  const sourceRef = React.useRef<PlaybackSource | null>(null);
  const playbackResolveRef = React.useRef<(() => void) | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const [isReady, setIsReady] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);

  const stop = React.useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    playbackResolveRef.current?.();
    playbackResolveRef.current = null;
    moduleRef.current?.streamStop(true);
    setIsPlaying(false);
    setIsGenerating(false);
  }, []);

  const getModule = React.useCallback(async () => {
    if (moduleRef.current) return moduleRef.current;
    if (!modulePromiseRef.current) {
      setError(null);
      setDownloadProgress(0);
      modulePromiseRef.current = TextToSpeechModule.fromModelName(TTS_MODEL, setDownloadProgress)
        .then((moduleInstance) => {
          moduleRef.current = moduleInstance;
          setIsReady(true);
          return moduleInstance;
        })
        .catch((loadError) => {
          modulePromiseRef.current = null;
          const nextError =
            loadError instanceof Error ? loadError : new Error('Unable to load voice playback.');
          setError(nextError);
          throw nextError;
        });
    }
    return modulePromiseRef.current;
  }, []);

  const speak = React.useCallback(
    async (text: string) => {
      const normalized = normalizeSpeechText(text);
      if (!normalized) return;

      stop();
      setIsPlaying(true);
      setIsGenerating(true);
      try {
        const moduleInstance = await getModule();
        const waveform = await moduleInstance.forward(normalized, 1);
        const sampleRate = getSpeechSampleRate();
        const context = getSpeechPlaybackContext();
        await context.resume().catch(() => undefined);
        const buffer = context.createBuffer(1, waveform.length, sampleRate);
        buffer.getChannelData(0).set(waveform);

        const source = context.createBufferSource() as PlaybackSource & {
          buffer: typeof buffer | null;
          connect: (destination: unknown) => void;
          start: () => void;
        };
        source.buffer = buffer;
        source.connect(context.destination);
        sourceRef.current = source;
        await new Promise<void>((resolve) => {
          playbackResolveRef.current = resolve;
          source.onEnded = () => {
            sourceRef.current = null;
            playbackResolveRef.current = null;
            setIsPlaying(false);
            setIsGenerating(false);
            resolve();
          };
          source.start();
        });
      } catch (error) {
        sourceRef.current = null;
        setIsPlaying(false);
        setIsGenerating(false);
        setError(error instanceof Error ? error : new Error('Unable to play voice output.'));
        throw error;
      }
    },
    [getModule, stop]
  );

  React.useEffect(
    () => () => {
      stop();
      moduleRef.current?.delete();
      moduleRef.current = null;
      modulePromiseRef.current = null;
    },
    [stop]
  );

  return {
    error,
    isReady,
    isGenerating,
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
