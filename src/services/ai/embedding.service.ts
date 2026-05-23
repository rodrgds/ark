import { ContentPackService } from '@/services/content/content-pack.service';
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

type LlamaModule = typeof import('llama.rn');
type LlamaContext = Awaited<ReturnType<LlamaModule['initLlama']>>;

export type EmbeddingResult = {
  modelId: string;
  dimensions: number;
  vector: number[];
  source: 'llama' | 'hash';
};

let llamaModulePromise: Promise<LlamaModule | null> | null = null;
let embeddingContextPromise: Promise<{
  context: LlamaContext;
  config: EmbeddingModelConfig;
} | null> | null = null;

export function resetEmbeddingServiceForTests() {
  llamaModulePromise = null;
  embeddingContextPromise = null;
}

export class EmbeddingService {
  static async getActiveModelConfig() {
    const packs = await ContentPackService.listPacks();
    const installed = packs.find(
      (pack) => isEmbeddingModelPack(pack) && pack.installed && pack.localUri
    );
    return getEmbeddingModelConfig(installed);
  }

  static async embedQuery(text: string): Promise<EmbeddingResult> {
    return this.embed(text, 'query');
  }

  static async embedDocument(text: string): Promise<EmbeddingResult> {
    return this.embed(text, 'document');
  }

  static async embed(text: string, purpose: 'query' | 'document'): Promise<EmbeddingResult> {
    const active = await getEmbeddingContext();
    if (!active) {
      return {
        modelId: RAG_HASH_EMBEDDING_MODEL_ID,
        dimensions: RAG_HASH_EMBEDDING_DIMENSIONS,
        vector: embedText(text),
        source: 'hash',
      };
    }

    try {
      const prefix = purpose === 'query' ? active.config.queryPrefix : active.config.documentPrefix;
      const result = await active.context.embedding(`${prefix}${text}`);
      const raw = (
        Array.isArray(result.embedding) ? result.embedding : Array.from(result.embedding)
      ) as number[];
      const vector = normalize(sliceVector(raw, active.config.dimension));
      return {
        modelId: active.config.id,
        dimensions: active.config.dimension,
        vector,
        source: 'llama',
      };
    } catch {
      return {
        modelId: RAG_HASH_EMBEDDING_MODEL_ID,
        dimensions: RAG_HASH_EMBEDDING_DIMENSIONS,
        vector: embedText(text),
        source: 'hash',
      };
    }
  }
}

async function getEmbeddingContext() {
  if (!embeddingContextPromise) {
    embeddingContextPromise = (async () => {
      const [module, packs] = await Promise.all([
        loadLlamaModule(),
        ContentPackService.listPacks(),
      ]);
      if (!module) return null;
      const pack = packs.find(
        (item) => isEmbeddingModelPack(item) && item.installed && item.localUri
      );
      const config = getEmbeddingModelConfig(pack);
      if (!pack?.localUri || !config) return null;
      const context = await module.initLlama({
        model: pack.localUri,
        embedding: true,
        n_ctx: config.family === 'qwen3' ? 8192 : 4096,
        n_gpu_layers: 0,
      });
      return { context, config };
    })().catch(() => null);
  }
  return embeddingContextPromise;
}

async function loadLlamaModule() {
  if (!llamaModulePromise) {
    llamaModulePromise = import('llama.rn').catch(() => null);
  }
  return llamaModulePromise;
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
