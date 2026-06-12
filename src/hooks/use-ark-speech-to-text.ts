import { VoiceRuntimeService } from '@/services/ai/voice-runtime.service';
import {
  SpeechToTextModule,
  type DecodingOptions,
  type TranscriptionResult,
} from 'react-native-executorch';
import * as React from 'react';

export function useArkSpeechToText() {
  const moduleRef = React.useRef<SpeechToTextModule | null>(null);
  const loadingRef = React.useRef<Promise<SpeechToTextModule> | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const [isReady, setIsReady] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const load = React.useCallback(async () => {
    if (moduleRef.current) return moduleRef.current;
    if (!loadingRef.current) {
      setError(null);
      loadingRef.current = VoiceRuntimeService.loadSpeechToText()
        .then((moduleInstance) => {
          moduleRef.current = moduleInstance;
          setError(null);
          setIsReady(true);
          setDownloadProgress(1);
          return moduleInstance;
        })
        .catch((loadError) => {
          const nextError =
            loadError instanceof Error ? loadError : new Error('Unable to load voice transcription.');
          setError(nextError);
          setIsReady(false);
          throw nextError;
        })
        .finally(() => {
          loadingRef.current = null;
        });
    }
    return loadingRef.current;
  }, []);

  const retry = React.useCallback(() => {
    moduleRef.current = VoiceRuntimeService.getSpeechToTextModule();
    if (moduleRef.current) {
      setError(null);
      setIsReady(true);
      setDownloadProgress(1);
      return Promise.resolve(moduleRef.current);
    }
    return load();
  }, [load]);

  const transcribe = React.useCallback(
    async (waveform: Float32Array, options: DecodingOptions = {}): Promise<TranscriptionResult> => {
      const moduleInstance = moduleRef.current;
      if (!moduleInstance) throw new Error('Voice transcription model is not ready.');
      if (isGenerating) throw new Error('Voice transcription is already running.');

      setIsGenerating(true);
      try {
        return await moduleInstance.transcribe(waveform, options);
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating]
  );

  React.useEffect(() => {
    let active = true;
    const unsubscribe = VoiceRuntimeService.subscribeSpeechToTextProgress((progress) => {
      if (active) setDownloadProgress(progress);
    });

    const existingModule = VoiceRuntimeService.getSpeechToTextModule();
    if (existingModule) {
      moduleRef.current = existingModule;
      setIsReady(true);
      setDownloadProgress(1);
    } else {
      setError(VoiceRuntimeService.getSpeechToTextError());
      void load().catch(() => undefined);
    }

    return () => {
      active = false;
      unsubscribe();
      moduleRef.current = null;
    };
  }, [load]);

  return {
    error,
    downloadProgress,
    isGenerating,
    isReady,
    retry,
    transcribe,
  };
}
