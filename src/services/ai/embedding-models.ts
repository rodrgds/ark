import type { ContentPack } from '@/types/content';

export type EmbeddingModelConfig = {
  id: string;
  family: 'nomic' | 'qwen3' | 'ark-hash';
  dimension: 256 | 768 | 1024;
  distance: 'cosine';
  queryPrefix: string;
  documentPrefix: string;
  normalize: boolean;
};

export const EMBEDDING_MODEL_CONFIGS: Record<string, EmbeddingModelConfig> = {
  'embedding-nomic-v15-q4-k-m': {
    id: 'embedding-nomic-v15-q4-k-m',
    family: 'nomic',
    dimension: 256,
    distance: 'cosine',
    queryPrefix: 'search_query: ',
    documentPrefix: 'search_document: ',
    normalize: true,
  },
  'embedding-qwen3-06b-q8': {
    id: 'embedding-qwen3-06b-q8',
    family: 'qwen3',
    dimension: 1024,
    distance: 'cosine',
    queryPrefix:
      'Instruct: Given a user question, retrieve relevant Ark offline knowledge.\nQuery: ',
    documentPrefix: '',
    normalize: true,
  },
};

export function isEmbeddingModelPack(pack: Pick<ContentPack, 'id' | 'title' | 'modelRole'>) {
  if (pack.modelRole) return pack.modelRole === 'embedding';
  return pack.id.startsWith('embedding-') || /embedding/i.test(pack.title);
}

export function getEmbeddingModelConfig(pack?: Pick<ContentPack, 'id' | 'title'> | null) {
  if (!pack) return null;
  const known = EMBEDDING_MODEL_CONFIGS[pack.id];
  if (known) return known;
  const title = pack.title.toLowerCase();
  if (title.includes('qwen')) {
    return { ...EMBEDDING_MODEL_CONFIGS['embedding-qwen3-06b-q8'], id: pack.id };
  }
  if (title.includes('nomic')) {
    return { ...EMBEDDING_MODEL_CONFIGS['embedding-nomic-v15-q4-k-m'], id: pack.id };
  }
  return null;
}
