import { FSMN_VAD, VADModule, type Segment } from 'react-native-executorch';
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

  React.useEffect(() => {
    let active = true;
    VADModule.fromModelName(FSMN_VAD, (progress) => {
      if (active) setDownloadProgress(progress);
    })
      .then((moduleInstance) => {
        if (!active) {
          moduleInstance.delete();
          return;
        }
        moduleRef.current = moduleInstance;
        setIsReady(true);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError : new Error('Unable to load voice activity.')
        );
      });

    return () => {
      active = false;
      moduleRef.current?.delete();
      moduleRef.current = null;
    };
  }, []);

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
    forward,
  };
}
