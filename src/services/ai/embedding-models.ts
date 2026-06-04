import type { ContentPack } from '@/types/content';

export type EmbeddingModelConfig = {
  id: string;
  family: 'executorch' | 'ark-hash';
  title: string;
  description: string;
  dimension: 256 | 384 | 768;
  distance: 'cosine';
  queryPrefix: string;
  documentPrefix: string;
  normalize: boolean;
};

export const EXECUTORCH_TEXT_EMBEDDING_MODEL_ID = 'executorch-multi-qa-minilm-l6-cos-v1';
export const EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS = 384;
export const EXECUTORCH_TEXT_EMBEDDING_TITLE = 'ExecuTorch multi-qa MiniLM source search';
export const EXECUTORCH_MPNET_EMBEDDING_MODEL_ID = 'executorch-multi-qa-mpnet-base-dot-v1';
export const EXECUTORCH_MPNET_EMBEDDING_DIMENSIONS = 768;
export const EXECUTORCH_MPNET_EMBEDDING_TITLE = 'ExecuTorch multi-qa MPNet source search';

export const EMBEDDING_MODEL_CONFIGS: Record<string, EmbeddingModelConfig> = {
  [EXECUTORCH_TEXT_EMBEDDING_MODEL_ID]: {
    id: EXECUTORCH_TEXT_EMBEDDING_MODEL_ID,
    family: 'executorch',
    title: EXECUTORCH_TEXT_EMBEDDING_TITLE,
    description: 'Balanced mobile retrieval with lower memory use and faster indexing.',
    dimension: EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS,
    distance: 'cosine',
    queryPrefix: '',
    documentPrefix: '',
    normalize: true,
  },
  [EXECUTORCH_MPNET_EMBEDDING_MODEL_ID]: {
    id: EXECUTORCH_MPNET_EMBEDDING_MODEL_ID,
    family: 'executorch',
    title: EXECUTORCH_MPNET_EMBEDDING_TITLE,
    description: 'Higher-quality retrieval for newer phones, with more memory and indexing cost.',
    dimension: EXECUTORCH_MPNET_EMBEDDING_DIMENSIONS,
    distance: 'cosine',
    queryPrefix: '',
    documentPrefix: '',
    normalize: true,
  },
};

export const EXECUTORCH_EMBEDDING_MODEL_OPTIONS = Object.values(EMBEDDING_MODEL_CONFIGS);

export function isEmbeddingModelPack(pack: Pick<ContentPack, 'id' | 'title' | 'modelRole'>) {
  if (pack.modelRole) return pack.modelRole === 'embedding';
  return pack.id.startsWith('embedding-') || /embedding/i.test(pack.title);
}

export function getEmbeddingModelConfig(pack?: Pick<ContentPack, 'id' | 'title'> | null) {
  if (!pack) return EMBEDDING_MODEL_CONFIGS[EXECUTORCH_TEXT_EMBEDDING_MODEL_ID];
  const known = EMBEDDING_MODEL_CONFIGS[pack.id];
  if (known) return known;
  return null;
}
