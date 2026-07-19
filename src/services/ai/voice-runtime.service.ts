import {
  FSMN_VAD,
  models,
  SpeechToTextModule,
  TextToSpeechModule,
  VADModule,
  WHISPER_TINY_EN,
} from 'react-native-executorch';

type ProgressListener = (progress: number) => void;

type VoiceRuntimeModule = {
  delete: () => void;
};

type RuntimeState<T extends VoiceRuntimeModule> = {
  module: T | null;
  promise: Promise<T> | null;
  progress: number;
  error: Error | null;
  listeners: Set<ProgressListener>;
  consumers: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

const TTS_MODEL = models.text_to_speech.kokoro.en_us.heart();
const TRANSIENT_LOAD_ATTEMPTS = 2;
const VOICE_RUNTIME_IDLE_MS = 60_000;

const ttsState: RuntimeState<TextToSpeechModule> = createRuntimeState();
const vadState: RuntimeState<VADModule> = createRuntimeState();
const sttState: RuntimeState<SpeechToTextModule> = createRuntimeState();

function createRuntimeState<T extends VoiceRuntimeModule>(): RuntimeState<T> {
  return {
    module: null,
    promise: null,
    progress: 0,
    error: null,
    listeners: new Set(),
    consumers: 0,
    idleTimer: null,
  };
}

function cancelIdleCleanup<T extends VoiceRuntimeModule>(state: RuntimeState<T>) {
  if (!state.idleTimer) return;
  clearTimeout(state.idleTimer);
  state.idleTimer = null;
}

function disposeRuntime<T extends VoiceRuntimeModule>(state: RuntimeState<T>) {
  cancelIdleCleanup(state);
  state.module?.delete();
  state.module = null;
  state.promise = null;
  state.progress = 0;
}

function scheduleIdleCleanup<T extends VoiceRuntimeModule>(state: RuntimeState<T>) {
  cancelIdleCleanup(state);
  if (state.consumers > 0 || !state.module) return;
  state.idleTimer = setTimeout(() => {
    state.idleTimer = null;
    if (state.consumers === 0) disposeRuntime(state);
  }, VOICE_RUNTIME_IDLE_MS);
}

function retainRuntime<T extends VoiceRuntimeModule>(state: RuntimeState<T>) {
  state.consumers += 1;
  cancelIdleCleanup(state);
  return () => {
    state.consumers = Math.max(0, state.consumers - 1);
    scheduleIdleCleanup(state);
  };
}

function publishProgress<T extends VoiceRuntimeModule>(state: RuntimeState<T>, progress: number) {
  const nextProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  state.progress = nextProgress;
  state.listeners.forEach((listener) => listener(nextProgress));
}

function subscribeProgress<T extends VoiceRuntimeModule>(
  state: RuntimeState<T>,
  listener: ProgressListener
) {
  state.listeners.add(listener);
  listener(state.progress);
  return () => {
    state.listeners.delete(listener);
  };
}

async function loadWithTransientRetry<T>(factory: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < TRANSIENT_LOAD_ATTEMPTS; attempt += 1) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= TRANSIENT_LOAD_ATTEMPTS || !isTransientVoiceLoadError(error)) break;
      await delay(900);
    }
  }
  throw lastError;
}

function isTransientVoiceLoadError(error: unknown) {
  const message = getErrorMessage(error);
  return (
    /software caused connection abort/i.test(message) ||
    /connection.*abort/i.test(message) ||
    /download.*interrupted/i.test(message) ||
    /network.*lost/i.test(message) ||
    /timed?\s*out/i.test(message) ||
    /econnreset/i.test(message) ||
    /socketexception/i.test(message)
  );
}

function toVoiceError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(getErrorMessage(error) || fallback);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? '');
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function loadRuntime<T extends VoiceRuntimeModule>(
  state: RuntimeState<T>,
  fallbackError: string,
  factory: (onProgress: ProgressListener) => Promise<T>
) {
  cancelIdleCleanup(state);
  if (state.module) return Promise.resolve(state.module);
  if (!state.promise) {
    state.error = null;
    publishProgress(state, 0);
    state.promise = loadWithTransientRetry(() =>
      factory((progress) => publishProgress(state, progress))
    )
      .then((moduleInstance) => {
        state.module = moduleInstance;
        state.error = null;
        publishProgress(state, 1);
        scheduleIdleCleanup(state);
        return moduleInstance;
      })
      .catch((error) => {
        state.promise = null;
        state.error = toVoiceError(error, fallbackError);
        throw state.error;
      });
  }
  return state.promise;
}

export class VoiceRuntimeService {
  static retainTextToSpeech() {
    return retainRuntime(ttsState);
  }

  static retainVoiceActivity() {
    return retainRuntime(vadState);
  }

  static retainSpeechToText() {
    return retainRuntime(sttState);
  }

  static loadTextToSpeech() {
    return loadRuntime(ttsState, 'Unable to load voice playback.', (onProgress) =>
      TextToSpeechModule.fromModelName(TTS_MODEL, onProgress)
    );
  }

  static loadVoiceActivity() {
    return loadRuntime(vadState, 'Unable to load voice activity.', (onProgress) =>
      VADModule.fromModelName(FSMN_VAD, onProgress)
    );
  }

  static loadSpeechToText() {
    return loadRuntime(sttState, 'Unable to load voice transcription.', (onProgress) =>
      SpeechToTextModule.fromModelName(
        {
          modelName: WHISPER_TINY_EN.modelName,
          isMultilingual: WHISPER_TINY_EN.isMultilingual,
          modelSource: WHISPER_TINY_EN.modelSource,
          tokenizerSource: WHISPER_TINY_EN.tokenizerSource,
        },
        undefined,
        onProgress
      )
    );
  }

  static subscribeTextToSpeechProgress(listener: ProgressListener) {
    return subscribeProgress(ttsState, listener);
  }

  static subscribeVoiceActivityProgress(listener: ProgressListener) {
    return subscribeProgress(vadState, listener);
  }

  static subscribeSpeechToTextProgress(listener: ProgressListener) {
    return subscribeProgress(sttState, listener);
  }

  static getTextToSpeechError() {
    return ttsState.error;
  }

  static getVoiceActivityError() {
    return vadState.error;
  }

  static getSpeechToTextError() {
    return sttState.error;
  }

  static getTextToSpeechModule() {
    return ttsState.module;
  }

  static getVoiceActivityModule() {
    return vadState.module;
  }

  static getSpeechToTextModule() {
    return sttState.module;
  }
}

export function resetVoiceRuntimeForTests() {
  const reset = <T extends VoiceRuntimeModule>(state: RuntimeState<T>) => {
    disposeRuntime(state);
    state.error = null;
    state.listeners.clear();
    state.consumers = 0;
  };
  reset(ttsState);
  reset(vadState);
  reset(sttState);
}
