import { VoiceRuntimeService } from '@/services/ai/voice-runtime.service';
import { VADModule, type Segment } from 'react-native-executorch';
import * as React from 'react';

type NativeVadModule = VADModule & {
  nativeModule: {
    generate: (waveform: Float32Array, mergeGap: number) => Promise<Segment[]>;
  };
};

export function useArkVoiceActivity() {
  const moduleRef = React.useRef<VADModule | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const [isReady, setIsReady] = React.useState(false);

  const load = React.useCallback(async () => {
    const existingModule = VoiceRuntimeService.getVoiceActivityModule();
    if (existingModule) {
      moduleRef.current = existingModule;
      setError(null);
      setIsReady(true);
      setDownloadProgress(1);
      return existingModule;
    }

    setError(null);
    const moduleInstance = await VoiceRuntimeService.loadVoiceActivity().catch((loadError) => {
      const nextError =
        loadError instanceof Error ? loadError : new Error('Unable to load voice activity.');
      setError(nextError);
      setIsReady(false);
      throw nextError;
    });
    moduleRef.current = moduleInstance;
    setError(null);
    setIsReady(true);
    setDownloadProgress(1);
    return moduleInstance;
  }, []);

  React.useEffect(() => {
    let active = true;
    const unsubscribe = VoiceRuntimeService.subscribeVoiceActivityProgress((progress) => {
      if (active) setDownloadProgress(progress);
    });

    const existingModule = VoiceRuntimeService.getVoiceActivityModule();
    if (existingModule) {
      moduleRef.current = existingModule;
      setIsReady(true);
      setDownloadProgress(1);
      return () => {
        active = false;
        unsubscribe();
        moduleRef.current = null;
      };
    }

    setError(VoiceRuntimeService.getVoiceActivityError());
    load()
      .then((moduleInstance) => {
        if (!active) return;
        moduleRef.current = moduleInstance;
        setError(null);
        setIsReady(true);
        setDownloadProgress(1);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError : new Error('Unable to load voice activity.')
        );
      });

    return () => {
      active = false;
      unsubscribe();
      moduleRef.current = null;
    };
  }, [load]);

  const forward = React.useCallback(async (waveform: Float32Array) => {
    const moduleInstance = moduleRef.current as NativeVadModule | null;
    if (!moduleInstance) throw new Error('Voice activity model is not ready.');

    // ExecuTorch 0.9's native VAD generate function requires mergeGap even though
    // its public TypeScript wrapper omits it.
    return moduleInstance.nativeModule.generate(waveform, 0);
  }, []);

  return {
    error,
    downloadProgress,
    isReady,
    retry: load,
    forward,
  };
}
