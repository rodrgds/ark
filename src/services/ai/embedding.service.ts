import {
  EMBEDDING_MODEL_CONFIGS,
  EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS,
  EXECUTORCH_TEXT_EMBEDDING_MODEL_ID,
} from '@/services/ai/embedding-models';
import {
  RAG_HASH_EMBEDDING_DIMENSIONS,
  RAG_HASH_EMBEDDING_MODEL_ID,
  embedText,
} from '@/services/ai/rag-embedding';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { MULTI_QA_MINILM_L6_COS_V1, TextEmbeddingsModule } from 'react-native-executorch';

type ExecuTorchTextEmbeddingModel = TextEmbeddingsModule;

export type EmbeddingResult = {
  modelId: string;
  dimensions: number;
  vector: number[];
  source: 'executorch' | 'hash';
};

let embeddingModelPromise: Promise<ExecuTorchTextEmbeddingModel | null> | null = null;

export function resetEmbeddingServiceForTests() {
  resetEmbeddingRuntimeContext();
}

export function resetEmbeddingRuntimeContext() {
  embeddingModelPromise?.then((model) => model?.delete()).catch(() => undefined);
  embeddingModelPromise = null;
}

export class EmbeddingService {
  static async getActiveModelConfig() {
    return EMBEDDING_MODEL_CONFIGS[EXECUTORCH_TEXT_EMBEDDING_MODEL_ID];
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

async function getEmbeddingModel() {
  if (await PreferencesService.getBatteryReduceModeEnabled()) return null;
  if (!embeddingModelPromise) {
    embeddingModelPromise = TextEmbeddingsModule.fromModelName(MULTI_QA_MINILM_L6_COS_V1).catch(
      () => null
    );
  }
  return embeddingModelPromise;
}

async function execuTorchEmbedding(
  text: string,
  purpose: 'query' | 'document'
): Promise<EmbeddingResult | null> {
  const model = await getEmbeddingModel();
  if (!model) return null;
  const config = EMBEDDING_MODEL_CONFIGS[EXECUTORCH_TEXT_EMBEDDING_MODEL_ID];
  const prefix = purpose === 'query' ? config.queryPrefix : config.documentPrefix;
  const vector = await model.forward(`${prefix}${text}`);
  return {
    modelId: EXECUTORCH_TEXT_EMBEDDING_MODEL_ID,
    dimensions: EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS,
    vector: normalize(sliceVector(Array.from(vector), EXECUTORCH_TEXT_EMBEDDING_DIMENSIONS)),
    source: 'executorch',
  };
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
