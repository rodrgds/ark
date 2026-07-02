import {
  EMBEDDING_MODEL_CONFIGS,
  EXECUTORCH_MPNET_EMBEDDING_MODEL_ID,
  type EmbeddingModelConfig,
} from '@/services/ai/embedding-models';
import {
  RAG_HASH_EMBEDDING_DIMENSIONS,
  RAG_HASH_EMBEDDING_MODEL_ID,
  embedText,
} from '@/services/ai/rag-embedding';
import { PreferencesService } from '@/services/preferences/preferences.service';
import {
  MULTI_QA_MINILM_L6_COS_V1,
  MULTI_QA_MPNET_BASE_DOT_V1,
  TextEmbeddingsModule,
} from 'react-native-executorch';

type ExecuTorchTextEmbeddingModel = TextEmbeddingsModule;

export type EmbeddingResult = {
  modelId: string;
  dimensions: number;
  vector: number[];
  source: 'executorch' | 'hash';
};

let embeddingModelPromise: Promise<ExecuTorchTextEmbeddingModel | null> | null = null;
let embeddingModelId: string | null = null;

export function resetEmbeddingServiceForTests() {
  resetEmbeddingRuntimeContext();
}

export function resetEmbeddingRuntimeContext() {
  embeddingModelPromise?.then((model) => model?.delete()).catch(() => undefined);
  embeddingModelPromise = null;
  embeddingModelId = null;
}

export class EmbeddingService {
  static async getActiveModelConfig() {
    const selectedId = await PreferencesService.getSelectedEmbeddingModelId();
    return getConfig(selectedId);
  }

  static async prepareActiveModel(onDownloadProgress?: (progress: number) => void) {
    const config = await this.getActiveModelConfig();
    return getEmbeddingModel(config, onDownloadProgress);
  }

  static async embedQuery(text: string): Promise<EmbeddingResult> {
    return this.embed(text, 'query');
  }

  static async embedDocument(text: string): Promise<EmbeddingResult> {
    return this.embed(text, 'document');
  }

  static async embed(text: string, purpose: 'query' | 'document'): Promise<EmbeddingResult> {
    const executorch = await execuTorchEmbedding(text, purpose).catch(() => null);
    return executorch ?? hashEmbedding(text);
  }
}

async function getEmbeddingModel(
  config: EmbeddingModelConfig,
  onDownloadProgress: (progress: number) => void = () => {}
) {
  if (config.family !== 'executorch') return null;
  if (await PreferencesService.getBatteryReduceModeEnabled()) return null;
  if (!embeddingModelPromise || embeddingModelId !== config.id) {
    resetEmbeddingRuntimeContext();
    embeddingModelId = config.id;
    embeddingModelPromise = TextEmbeddingsModule.fromModelName(
      getRuntimeModel(config.id),
      onDownloadProgress
    ).catch(() => null);
  }
  return embeddingModelPromise;
}

async function execuTorchEmbedding(
  text: string,
  purpose: 'query' | 'document'
): Promise<EmbeddingResult | null> {
  const config = await EmbeddingService.getActiveModelConfig();
  if (config.family !== 'executorch') return null;
  const model = await getEmbeddingModel(config);
  if (!model) return null;
  const prefix = purpose === 'query' ? config.queryPrefix : config.documentPrefix;
  const vector = await model.forward(`${prefix}${text}`);
  return {
    modelId: config.id,
    dimensions: config.dimension,
    vector: normalize(sliceVector(Array.from(vector), config.dimension)),
    source: 'executorch',
  };
}

function getConfig(modelId: string | null) {
  return (
    EMBEDDING_MODEL_CONFIGS[modelId ?? ''] ??
    EMBEDDING_MODEL_CONFIGS[RAG_HASH_EMBEDDING_MODEL_ID]
  );
}

function getRuntimeModel(modelId: string) {
  return modelId === EXECUTORCH_MPNET_EMBEDDING_MODEL_ID
    ? MULTI_QA_MPNET_BASE_DOT_V1
    : MULTI_QA_MINILM_L6_COS_V1;
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
