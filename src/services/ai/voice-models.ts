import type { ContentPack, ContentPackManifest } from '@/types/content';

export const VOICE_MODEL_PROJECTORS: Record<string, string> = {};

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
