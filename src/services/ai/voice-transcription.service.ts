import { getVoiceProjectorId } from '@/services/ai/voice-models';
import { ContentPackService } from '@/services/content/content-pack.service';
import { PreferencesService } from '@/services/preferences/preferences.service';

type LlamaRnModule = typeof import('llama.rn');
type LlamaContext = Awaited<ReturnType<LlamaRnModule['initLlama']>>;

let llamaModulePromise: Promise<LlamaRnModule | null> | null = null;
let voiceContextPromise: Promise<LlamaContext | null> | null = null;
let voiceContextKey: string | null = null;

export function resetVoiceRuntimeContext() {
  const contextPromise = voiceContextPromise;
  voiceContextPromise = null;
  voiceContextKey = null;
  void contextPromise?.then((context) => context?.release().catch(() => undefined));
}

export async function isVoiceRuntimeAvailable() {
  return !!(await loadLlamaModule());
}

export class VoiceTranscriptionService {
  static async transcribeWithAndroidSpeech() {
    const module = await loadArkSpeechModule();
    if (!module) {
      throw new Error(
        'Voice input needs the ArkSpeech development build. Rebuild the app to enable platform speech recognition.'
      );
    }
    const available = await module.isAvailable();
    if (!available) {
      throw new Error('Speech recognition is not available on this device.');
    }
    const transcript = await module.recognizeOnce({
      preferOffline: true,
      timeoutMs: 45000,
    });
    const text = transcript.text.trim();
    if (!text) throw new Error('Android speech recognition returned an empty transcript.');
    return text;
  }

  static async transcribeAudio(audioUri: string) {
    const format = audioFormatFromUri(audioUri);
    if (!format) {
      throw new Error('Voice transcription needs a WAV or MP3 recording.');
    }

    const selectedModelId = await PreferencesService.getSelectedVoiceModelId();
    const model = selectedModelId
      ? (await listInstalledVoiceModels()).find((item) => item.id === selectedModelId)
      : await getActiveVoiceModel();
    if (!model?.localUri) {
      throw new Error('Download a voice model in Settings > AI before using voice input.');
    }
    const projector = await getInstalledVoiceProjectorForModel(model.id);
    if (!projector?.localUri) {
      throw new Error(
        'Download the matching voice projector in Settings > AI before using voice input.'
      );
    }

    const context = await getVoiceContext(model.localUri, projector.localUri);
    if (!context) {
      throw new Error('Voice transcription needs a development build with llama.rn enabled.');
    }

    const result = await context.completion({
      messages: [
        {
          role: 'system',
          content:
            'You are an offline speech-to-text engine. Transcribe the audio exactly in the original spoken language. Return only the transcript.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this voice prompt:' },
            {
              type: 'input_audio',
              input_audio: {
                url: audioUri,
                format,
              },
            },
          ],
        },
      ],
      n_predict: 1024,
      temperature: 0.1,
      top_p: 0.95,
    });

    const transcript = (result.content || result.text || '').trim();
    if (!transcript) throw new Error('The voice model returned an empty transcript.');
    return transcript;
  }
}

async function loadLlamaModule() {
  if (!llamaModulePromise) {
    llamaModulePromise = import('llama.rn').catch(() => null);
  }
  return llamaModulePromise;
}

async function loadArkSpeechModule() {
  return import('ark-speech').catch(() => null);
}

async function listInstalledVoiceModels() {
  return (await ContentPackService.listPacks()).filter(
    (pack) =>
      pack.category === 'AI Models' && pack.modelRole === 'voice' && pack.installed && pack.localUri
  );
}

async function listInstalledVoiceProjectors() {
  return (await ContentPackService.listPacks()).filter(
    (pack) =>
      pack.category === 'AI Models' &&
      pack.modelRole === 'voiceProjector' &&
      pack.installed &&
      pack.localUri
  );
}

async function getActiveVoiceModel() {
  const installed = await listInstalledVoiceModels();
  const selectedId = await PreferencesService.getSelectedVoiceModelId();
  return installed.find((model) => model.id === selectedId) ?? installed[0] ?? null;
}

async function getInstalledVoiceProjectorForModel(modelId: string | null | undefined) {
  if (!modelId) return null;
  const projectorId = getVoiceProjectorId(modelId);
  if (!projectorId) return null;
  return (await listInstalledVoiceProjectors()).find((model) => model.id === projectorId) ?? null;
}

async function getVoiceContext(modelUri: string, projectorUri: string) {
  const key = `${modelUri}:${projectorUri}`;
  if (!voiceContextPromise || voiceContextKey !== key) {
    resetVoiceRuntimeContext();
    voiceContextKey = key;
    voiceContextPromise = (async () => {
      const module = await loadLlamaModule();
      if (!module) return null;
      const context = await module.initLlama({
        model: modelUri,
        n_ctx: 10240,
        n_gpu_layers: 0,
        ctx_shift: false,
      });
      const initialized = await context.initMultimodal({
        path: projectorUri,
        use_gpu: true,
      });
      if (!initialized) {
        await context.release().catch(() => undefined);
        throw new Error('Unable to initialize the voice model audio projector.');
      }
      return context;
    })().catch(() => null);
  }
  return voiceContextPromise;
}

function audioFormatFromUri(uri: string): 'wav' | 'mp3' | null {
  const normalized = uri.split('?')[0].toLowerCase();
  if (normalized.endsWith('.wav')) return 'wav';
  if (normalized.endsWith('.mp3')) return 'mp3';
  return null;
}
