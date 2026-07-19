import { ContentPackService } from '@/services/content/content-pack.service';
import {
  DEFAULT_EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_OPTIONS,
  EMBEDDING_MODEL_CONFIGS,
  isEmbeddingModelPack,
} from '@/services/ai/embedding-models';
import { EmbeddingService, resetEmbeddingRuntimeContext } from '@/services/ai/embedding.service';
import {
  getVoiceProjectorId,
  isVoiceModelPack,
  isVoiceProjectorPack,
} from '@/services/ai/voice-models';
import { getVisionProjectorId, isVisionProjectorPack } from '@/services/ai/vision-models';
import { resetVoiceRuntimeContext } from '@/services/ai/voice-transcription.service';
import { RAG_HASH_EMBEDDING_MODEL_ID } from '@/services/ai/rag-embedding';
import { RagService } from '@/services/ai/rag.service';
import { DatabaseClient } from '@/services/db/client';
import { LlamaAdapter, resetLlamaRuntimeContext } from '@/services/ai/llama-adapter';
import { PreferencesService } from '@/services/preferences/preferences.service';
import type { RagEmbeddingRebuildProgress } from '@/services/ai/rag/embed';
import { resolveAiRuntimeAdapter } from '@/services/ai/model-runtime';

const llamaAdapter = new LlamaAdapter();

export class ModelManagerService {
  static async listAvailableModels() {
    return (await ContentPackService.listPacks()).filter((pack) => pack.category === 'AI Models');
  }

  static async listAvailableChatModels() {
    return (await this.listAvailableModels()).filter(
      (model) =>
        !isEmbeddingModelPack(model) &&
        !isVoiceModelPack(model) &&
        !isVoiceProjectorPack(model) &&
        !isVisionProjectorPack(model)
    );
  }

  static async listAvailableEmbeddingModels() {
    return EMBEDDING_MODEL_OPTIONS;
  }

  static async listAvailableVoiceModels() {
    return (await this.listAvailableModels()).filter((model) => isVoiceModelPack(model));
  }

  static async listAvailableVoiceProjectors() {
    return (await this.listAvailableModels()).filter((model) => isVoiceProjectorPack(model));
  }

  static async listAvailableVisionProjectors() {
    return (await this.listAvailableModels()).filter((model) => isVisionProjectorPack(model));
  }

  static async listInstalledModels() {
    return (await this.listAvailableModels()).filter((model) => model.installed && model.localUri);
  }

  static async listInstalledChatModels() {
    return (await this.listAvailableChatModels()).filter(
      (model) => model.installed && model.localUri
    );
  }

  static async listInstalledEmbeddingModels() {
    const active = await this.getActiveEmbeddingModel();
    return active ? [active] : [];
  }

  static async listInstalledVoiceModels() {
    return (await this.listAvailableVoiceModels()).filter(
      (model) => model.installed && model.localUri
    );
  }

  static async listInstalledVoiceProjectors() {
    return (await this.listAvailableVoiceProjectors()).filter(
      (model) => model.installed && model.localUri
    );
  }

  static async listInstalledVisionProjectors() {
    return (await this.listAvailableVisionProjectors()).filter(
      (model) => model.installed && model.localUri
    );
  }

  static async getActiveModel() {
    if (await PreferencesService.getAiChatModelDisabled()) return null;
    const installed = await this.listInstalledChatModels();
    const selectedId = await PreferencesService.getSelectedAiModelId();
    return installed.find((model) => model.id === selectedId) ?? installed[0] ?? null;
  }

  static async getActiveEmbeddingModel() {
    return EmbeddingService.getActiveModelConfig();
  }

  static async getActiveVoiceModel() {
    const installed = await this.listInstalledVoiceModels();
    const selectedId = await PreferencesService.getSelectedVoiceModelId();
    return installed.find((model) => model.id === selectedId) ?? installed[0] ?? null;
  }

  static async getVoiceProjectorForModel(modelId: string | null | undefined) {
    if (!modelId) return null;
    const projectorId = getVoiceProjectorId(modelId);
    if (!projectorId) return null;
    return (
      (await this.listAvailableVoiceProjectors()).find((model) => model.id === projectorId) ?? null
    );
  }

  static async getInstalledVoiceProjectorForModel(modelId: string | null | undefined) {
    const projector = await this.getVoiceProjectorForModel(modelId);
    return projector?.installed && projector.localUri ? projector : null;
  }

  static async getVisionProjectorForModel(modelId: string | null | undefined) {
    if (!modelId) return null;
    const projectorId = getVisionProjectorId(modelId);
    if (!projectorId) return null;
    return (
      (await this.listAvailableVisionProjectors()).find((model) => model.id === projectorId) ?? null
    );
  }

  static async getInstalledVisionProjectorForModel(modelId: string | null | undefined) {
    const projector = await this.getVisionProjectorForModel(modelId);
    return projector?.installed && projector.localUri ? projector : null;
  }

  static async getPreferences() {
    const [
      modelPickerEnabled,
      selectedModelId,
      selectedEmbeddingModelId,
      selectedVoiceModelId,
      chatModelDisabled,
    ] = await Promise.all([
      PreferencesService.getAiModelPickerEnabled(),
      PreferencesService.getSelectedAiModelId(),
      PreferencesService.getSelectedEmbeddingModelId(),
      PreferencesService.getSelectedVoiceModelId(),
      PreferencesService.getAiChatModelDisabled(),
    ]);
    return {
      modelPickerEnabled,
      selectedModelId,
      selectedEmbeddingModelId,
      selectedVoiceModelId,
      chatModelDisabled,
    };
  }

  static async setModelPickerEnabled(enabled: boolean) {
    await PreferencesService.setAiModelPickerEnabled(enabled);
  }

  static async setSelectedModel(modelId: string | null) {
    if (modelId) {
      const model = (await this.listAvailableChatModels()).find((item) => item.id === modelId);
      if (!model) throw new Error('Choose a chat model. Search models cannot be used for chat.');
    }
    await PreferencesService.setAiChatModelDisabled(!modelId);
    await PreferencesService.setSelectedAiModelId(modelId);
    resetLlamaRuntimeContext();
  }

  static async setSelectedEmbeddingModel(
    modelId: string | null,
    options:
      | ((progress: number) => void)
      | {
          onDownloadProgress?: (progress: number) => void;
          onRebuildProgress?: (progress: RagEmbeddingRebuildProgress) => void | Promise<void>;
        } = {}
  ) {
    const callbacks = typeof options === 'function' ? { onDownloadProgress: options } : options;
    const nextModelId = modelId ?? DEFAULT_EMBEDDING_MODEL_ID;
    const nextModel = EMBEDDING_MODEL_CONFIGS[nextModelId];
    if (!nextModel) {
      throw new Error('Choose a supported source-search model.');
    }
    if (
      nextModel.family === 'executorch' &&
      (await PreferencesService.getBatteryReduceModeEnabled())
    ) {
      throw new Error('Turn off Battery Reduce Mode before changing the source-search model.');
    }
    const previousModelId = await PreferencesService.getSelectedEmbeddingModelId();
    await PreferencesService.setSelectedEmbeddingModelId(nextModelId);
    resetEmbeddingRuntimeContext();
    const model = await EmbeddingService.prepareActiveModel(callbacks.onDownloadProgress);
    if (nextModel.family === 'executorch' && !model) {
      await PreferencesService.setSelectedEmbeddingModelId(
        previousModelId ?? DEFAULT_EMBEDDING_MODEL_ID
      );
      resetEmbeddingRuntimeContext();
      throw new Error('Unable to download or load the source-search model.');
    }
    try {
      await RagService.rebuildEmbeddingsForActiveModel({
        onProgress: callbacks.onRebuildProgress,
      });
    } catch (error) {
      await PreferencesService.setSelectedEmbeddingModelId(
        previousModelId ?? DEFAULT_EMBEDDING_MODEL_ID
      );
      resetEmbeddingRuntimeContext();
      throw error;
    }
  }

  static async setSelectedVoiceModel(modelId: string | null) {
    if (modelId) {
      const model = (await this.listAvailableVoiceModels()).find((item) => item.id === modelId);
      if (!model) throw new Error('Choose a voice transcription model.');
    }
    await PreferencesService.setSelectedVoiceModelId(modelId);
    resetVoiceRuntimeContext();
  }

  static async setChatModelDisabled(disabled: boolean) {
    await PreferencesService.setAiChatModelDisabled(disabled);
    if (disabled) {
      await PreferencesService.setSelectedAiModelId(null);
    }
    resetLlamaRuntimeContext();
  }

  static async getStatus() {
    const [models, chatModels, voiceModels] = await Promise.all([
      this.listAvailableModels(),
      this.listAvailableChatModels(),
      this.listAvailableVoiceModels(),
    ]);
    const installedChatModels = chatModels.filter((model) => model.installed);
    const installedVoiceModels = voiceModels.filter((model) => model.installed);
    const activeVoiceModel = await this.getActiveVoiceModel();
    const activeVoiceProjector = await this.getInstalledVoiceProjectorForModel(
      activeVoiceModel?.id
    );
    const runtime = await llamaAdapter.getRuntimeStatus();
    const adapter = resolveAiRuntimeAdapter({
      moduleAvailable: runtime.moduleAvailable,
      modelUri: runtime.modelUri,
      installedChatModels: installedChatModels.length,
    });
    const preferences = await this.getPreferences();

    return {
      adapter,
      installedModels: installedChatModels.length,
      installedChatModels: installedChatModels.length,
      installedEmbeddingModels: 1,
      installedVoiceModels: installedVoiceModels.length,
      availableModels: models.length,
      availableChatModels: chatModels.length,
      availableEmbeddingModels: EMBEDDING_MODEL_OPTIONS.length,
      availableVoiceModels: voiceModels.length,
      selectedModelId: preferences.selectedModelId,
      selectedEmbeddingModelId: preferences.selectedEmbeddingModelId,
      selectedVoiceModelId: preferences.selectedVoiceModelId,
      modelPickerEnabled: preferences.modelPickerEnabled,
      chatModelDisabled: preferences.chatModelDisabled,
      activeVoiceModelTitle: activeVoiceModel?.title ?? null,
      voiceReady: !!activeVoiceModel?.localUri && !!activeVoiceProjector?.localUri,
      activeModelTitle: runtime.modelTitle,
      contextTokens: runtime.contextTokens,
      maxResponseTokens: runtime.maxResponseTokens,
      message: preferences.chatModelDisabled
        ? 'Answer model is disabled. Ask Arky will use local source search only.'
        : adapter === 'llama'
          ? `${runtime.modelTitle ?? 'Local model'} is ready for offline answers.`
          : adapter === 'llama-unavailable'
            ? 'An answer model is downloaded, but the local AI runtime is not available in this build.'
            : installedChatModels.length
              ? 'An answer model is downloaded. Use a build with local AI enabled to run it fully offline.'
              : 'No answer model is installed. Add an answer GGUF in Settings > AI before using offline AI.',
    };
  }

  static async getVoiceStatus() {
    const [availableVoiceModels, installedVoiceModels, activeVoiceModel] = await Promise.all([
      this.listAvailableVoiceModels(),
      this.listInstalledVoiceModels(),
      this.getActiveVoiceModel(),
    ]);
    const projector = await this.getVoiceProjectorForModel(activeVoiceModel?.id);
    const installedProjector = await this.getInstalledVoiceProjectorForModel(activeVoiceModel?.id);
    return {
      availableVoiceModels: availableVoiceModels.length,
      installedVoiceModels: installedVoiceModels.length,
      activeVoiceModel,
      projector,
      installedProjector,
      ready: !!activeVoiceModel?.localUri && !!installedProjector?.localUri,
      message: !activeVoiceModel
        ? 'Download a voice model to dictate Ask Arky prompts offline.'
        : !installedProjector
          ? 'Download the matching audio projector before using voice transcription.'
          : `${activeVoiceModel.title} is ready for offline transcription.`,
    };
  }

  static async getEmbeddingIndexStatus() {
    const [db, reduceModeEnabled] = await Promise.all([
      DatabaseClient.getDb(),
      PreferencesService.getBatteryReduceModeEnabled(),
    ]);
    const chunkRows = await db.getAllAsync<{
      model_id: string;
      domain: string;
      embedded_count: number;
    }>(
      `SELECT ce.model_id AS model_id,
              CASE
                WHEN s.kind = 'note' THEN 'notes'
                WHEN s.kind = 'guide' THEN 'guides'
                WHEN s.kind = 'document' THEN 'documents'
                WHEN s.kind = 'rss' THEN 'rss'
                WHEN s.kind IN ('map_marker', 'map_route', 'map_region') THEN 'maps'
                WHEN s.kind IN ('zim', 'zim_article') THEN 'zim'
                ELSE 'other'
              END AS domain,
              COUNT(*) AS embedded_count
       FROM chunk_embeddings ce
       JOIN rag_chunks c ON c.id = ce.chunk_id
       JOIN rag_sources s ON s.id = c.source_id
       GROUP BY ce.model_id, domain`
    );
    const totalRows = await db.getAllAsync<{ domain: string; total_count: number }>(
      `SELECT CASE
                WHEN kind = 'note' THEN 'notes'
                WHEN kind = 'guide' THEN 'guides'
                WHEN kind = 'document' THEN 'documents'
                WHEN kind = 'rss' THEN 'rss'
                WHEN kind IN ('map_marker', 'map_route', 'map_region') THEN 'maps'
                WHEN kind IN ('zim', 'zim_article') THEN 'zim'
                ELSE 'other'
              END AS domain,
              COUNT(c.id) AS total_count
       FROM rag_sources s
       JOIN rag_chunks c ON c.source_id = s.id
       GROUP BY domain`
    );
    const domains = ['notes', 'guides', 'documents', 'rss', 'maps', 'zim'] as const;
    const totals = Object.fromEntries(totalRows.map((row) => [row.domain, row.total_count]));
    const activeEmbeddingModel = await this.getActiveEmbeddingModel();
    const reportModels = EMBEDDING_MODEL_OPTIONS.map((model) => ({
      id: model.id,
      title: `${model.title} (${model.dimension}d)`,
      installed: model.id === RAG_HASH_EMBEDDING_MODEL_ID || model.id === activeEmbeddingModel.id,
    }));

    return reportModels.map((model) => {
      const byDomain = domains.map((domain) => {
        const total = totals[domain] ?? 0;
        const embedded =
          chunkRows.find((row) => row.model_id === model.id && row.domain === domain)
            ?.embedded_count ?? 0;
        return {
          domain,
          total,
          embedded,
          complete: total === 0 ? 1 : embedded / total,
        };
      });
      const total = byDomain.reduce((sum, row) => sum + row.total, 0);
      const embedded = byDomain.reduce((sum, row) => sum + row.embedded, 0);
      return {
        ...model,
        active: reduceModeEnabled
          ? model.id === RAG_HASH_EMBEDDING_MODEL_ID
          : model.id === activeEmbeddingModel.id,
        total,
        embedded,
        complete: total === 0 ? 1 : embedded / total,
        domains: byDomain,
      };
    });
  }
}

export { resolveAiRuntimeAdapter } from '@/services/ai/model-runtime';
