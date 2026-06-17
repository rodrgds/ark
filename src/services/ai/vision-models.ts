import type { ContentPack, ContentPackManifest } from '@/types/content';

export const VISION_MODEL_PROJECTORS: Record<string, string> = {
  'model-gemma4-e2b-it-q4-k-m': 'model-gemma4-e2b-it-mmproj-f16',
  'model-gemma4-e4b-it-q4-k-m': 'model-gemma4-e4b-it-mmproj-f16',
};

type ModelLike = Pick<ContentPack | ContentPackManifest, 'id' | 'title' | 'modelRole'>;

export function isVisionProjectorPack(pack: Pick<ModelLike, 'modelRole'>) {
  return pack.modelRole === 'visionProjector';
}

export function getVisionProjectorId(modelId: string | null | undefined) {
  if (!modelId) return null;
  return VISION_MODEL_PROJECTORS[modelId] ?? null;
}

export function isVisionCapableChatModel(model: ModelLike | null | undefined) {
  if (!model || model.modelRole !== 'chat') return false;
  if (getVisionProjectorId(model.id)) return true;
  return /\bgemma\s*4\b/i.test(model.title);
}
