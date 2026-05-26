import { embed } from 'ai';
import {
  EMBEDDING_MODEL_CONFIGS,
  getEmbeddingModelConfig,
  isEmbeddingModelPack,
  type EmbeddingModelConfig,
} from '@/services/ai/embedding-models';
import {
  RAG_HASH_EMBEDDING_DIMENSIONS,
  RAG_HASH_EMBEDDING_MODEL_ID,
  embedText,
} from '@/services/ai/rag-embedding';
import { ContentRepository } from '@/services/db/repositories/content.repo';
import { PreferencesService } from '@/services/preferences/preferences.service';

type ReactNativeAiLlamaModule = typeof import('@react-native-ai/llama');
type LlamaEmbeddingModel = ReturnType<ReactNativeAiLlamaModule['llama']['textEmbeddingModel']>;

export type EmbeddingResult = {
  modelId: string;
  dimensions: number;
  vector: number[];
  source: 'llama' | 'hash';
};

let llamaModulePromise: Promise<ReactNativeAiLlamaModule | null> | null = null;
let embeddingModelPromise: Promise<{
  model: LlamaEmbeddingModel;
  config: EmbeddingModelConfig;
} | null> | null = null;

export function resetEmbeddingServiceForTests() {
  llamaModulePromise = null;
  embeddingModelPromise = null;
}

export function resetEmbeddingRuntimeContext() {
  embeddingModelPromise = null;
}

export class EmbeddingService {
  static async getActiveModelConfig() {
    const packs = await listContentPacks();
    const installedModels = packs.filter(
      (pack) => isEmbeddingModelPack(pack) && pack.installed && pack.localUri
    );
    const selectedId = await PreferencesService.getSelectedEmbeddingModelId();
    const installed =
      installedModels.find((pack) => pack.id === selectedId) ?? installedModels[0] ?? null;
    return getEmbeddingModelConfig(installed);
  }

  static async embedQuery(text: string): Promise<EmbeddingResult> {
    return this.embed(text, 'query');
  }

  static async embedDocument(text: string): Promise<EmbeddingResult> {
    return this.embed(text, 'document');
  }

  static async embed(text: string, purpose: 'query' | 'document'): Promise<EmbeddingResult> {
    const active = await getEmbeddingModel();
    if (!active) return hashEmbedding(text);

    try {
      const prefix = purpose === 'query' ? active.config.queryPrefix : active.config.documentPrefix;
      const result = await embed({
        model: active.model,
        value: `${prefix}${text}`,
      });
      const vector = normalize(sliceVector(result.embedding, active.config.dimension));
      return {
        modelId: active.config.id,
        dimensions: active.config.dimension,
        vector,
        source: 'llama',
      };
    } catch {
      return hashEmbedding(text);
    }
  }
}

async function getEmbeddingModel() {
  if (!embeddingModelPromise) {
    embeddingModelPromise = (async () => {
      const [module, packs] = await Promise.all([loadLlamaModule(), listContentPacks()]);
      if (!module) return null;
      const selectedId = await PreferencesService.getSelectedEmbeddingModelId();
      const fallbackPack = packs.find(
        (item) => isEmbeddingModelPack(item) && item.installed && item.localUri
      );
      const selectedPack =
        packs.find(
          (item) =>
            item.id === selectedId && isEmbeddingModelPack(item) && item.installed && item.localUri
        ) ?? fallbackPack;
      const config = getEmbeddingModelConfig(selectedPack);
      if (!selectedPack?.localUri || !config) return null;
      const model = module.llama.textEmbeddingModel(selectedPack.localUri, {
        normalize: -1,
        contextParams: {
          n_ctx: config.family === 'qwen3' ? 8192 : 4096,
          n_gpu_layers: 0,
          n_parallel: 8,
        },
      });
      await model.prepare();
      return { model, config };
    })().catch(() => null);
  }
  return embeddingModelPromise;
}

async function loadLlamaModule() {
  if (!llamaModulePromise) {
    llamaModulePromise = import('@react-native-ai/llama').catch(() => null);
  }
  return llamaModulePromise;
}

async function listContentPacks() {
  return ContentRepository.list();
}

function hashEmbedding(text: string): EmbeddingResult {
  return {
    modelId: RAG_HASH_EMBEDDING_MODEL_ID,
    dimensions: RAG_HASH_EMBEDDING_DIMENSIONS,
    vector: embedText(text),
    source: 'hash',
  };
}

function sliceVector(vector: number[], dimensions: number) {
  if (vector.length >= dimensions) return vector.slice(0, dimensions);
  return [...vector, ...new Array(dimensions - vector.length).fill(0)];
}

function normalize(vector: number[]) {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!length) return vector;
  return vector.map((value) => value / length);
}

export function embeddingModelConfigsForTests() {
  return EMBEDDING_MODEL_CONFIGS;
}
