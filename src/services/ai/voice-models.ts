import type { ContentPack, ContentPackManifest } from '@/types/content';

export const DEFAULT_VOICE_MODEL_ID = 'voice-qwen3-asr-17b-q8-0';
export const DEFAULT_VOICE_PROJECTOR_ID = 'voice-qwen3-asr-17b-mmproj-bf16';

export const VOICE_MODEL_PROJECTORS: Record<string, string> = {
  [DEFAULT_VOICE_MODEL_ID]: DEFAULT_VOICE_PROJECTOR_ID,
};

type ModelLike = Pick<ContentPack | ContentPackManifest, 'id' | 'modelRole'>;

export function isVoiceModelPack(pack: ModelLike) {
  return pack.modelRole === 'voice';
}

export function isVoiceProjectorPack(pack: ModelLike) {
  return pack.modelRole === 'voiceProjector';
}

export function getVoiceProjectorId(modelId: string) {
  return VOICE_MODEL_PROJECTORS[modelId] ?? null;
}
