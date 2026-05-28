import { ContentPackService } from '@/services/content/content-pack.service';
import { isEmbeddingModelPack } from '@/services/ai/embedding-models';
import { resetEmbeddingRuntimeContext } from '@/services/ai/embedding.service';
import {
  getVoiceProjectorId,
  isVoiceModelPack,
  isVoiceProjectorPack,
} from '@/services/ai/voice-models';
import { resetVoiceRuntimeContext } from '@/services/ai/voice-transcription.service';
import {
  RAG_HASH_EMBEDDING_DIMENSIONS,
  RAG_HASH_EMBEDDING_MODEL_ID,
} from '@/services/ai/rag-embedding';
import { RagService } from '@/services/ai/rag.service';
import { DatabaseClient } from '@/services/db/client';
import { LlamaAdapter, resetLlamaRuntimeContext } from '@/services/ai/llama-adapter';
import { PreferencesService } from '@/services/preferences/preferences.service';

const llamaAdapter = new LlamaAdapter();

export class ModelManagerService {
  static async listAvailableModels() {
    return (await ContentPackService.listPacks()).filter((pack) => pack.category === 'AI Models');
  }

  static async listAvailableChatModels() {
    return (await this.listAvailableModels()).filter(
      (model) =>
        !isEmbeddingModelPack(model) && !isVoiceModelPack(model) && !isVoiceProjectorPack(model)
    );
  }

  static async listAvailableEmbeddingModels() {
    return (await this.listAvailableModels()).filter((model) => isEmbeddingModelPack(model));
  }

  static async listAvailableVoiceModels() {
    return (await this.listAvailableModels()).filter((model) => isVoiceModelPack(model));
  }

  static async listAvailableVoiceProjectors() {
    return (await this.listAvailableModels()).filter((model) => isVoiceProjectorPack(model));
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
    return (await this.listAvailableEmbeddingModels()).filter(
      (model) => model.installed && model.localUri
    );
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

  static async getActiveModel() {
    if (await PreferencesService.getAiChatModelDisabled()) return null;
    const installed = await this.listInstalledChatModels();
    const selectedId = await PreferencesService.getSelectedAiModelId();
    return installed.find((model) => model.id === selectedId) ?? installed[0] ?? null;
  }

  static async getActiveEmbeddingModel() {
    const installed = await this.listInstalledEmbeddingModels();
    const selectedId = await PreferencesService.getSelectedEmbeddingModelId();
    return installed.find((model) => model.id === selectedId) ?? installed[0] ?? null;
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

  static async setSelectedEmbeddingModel(modelId: string | null) {
    if (modelId) {
      const model = (await this.listAvailableEmbeddingModels()).find((item) => item.id === modelId);
      if (!model)
        throw new Error('Choose a search model. Chat models cannot build source indexes.');
    }
    await PreferencesService.setSelectedEmbeddingModelId(modelId);
    resetEmbeddingRuntimeContext();
    await RagService.markAllSourcesForReindex();
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
    const [models, chatModels, embeddingModels, voiceModels] = await Promise.all([
      this.listAvailableModels(),
      this.listAvailableChatModels(),
      this.listAvailableEmbeddingModels(),
      this.listAvailableVoiceModels(),
    ]);
    const installedChatModels = chatModels.filter((model) => model.installed);
    const installedEmbeddingModels = embeddingModels.filter((model) => model.installed);
    const installedVoiceModels = voiceModels.filter((model) => model.installed);
    const activeVoiceModel = await this.getActiveVoiceModel();
    const activeVoiceProjector = await this.getInstalledVoiceProjectorForModel(
      activeVoiceModel?.id
    );
    const runtime = await llamaAdapter.getRuntimeStatus();
    const adapter = runtime.moduleAvailable && runtime.modelUri ? 'llama' : 'mock';
    const preferences = await this.getPreferences();

    return {
      adapter,
      installedModels: installedChatModels.length,
      installedChatModels: installedChatModels.length,
      installedEmbeddingModels: installedEmbeddingModels.length,
      installedVoiceModels: installedVoiceModels.length,
      availableModels: models.length,
      availableChatModels: chatModels.length,
      availableEmbeddingModels: embeddingModels.length,
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
    const [db, models, activeEmbedding] = await Promise.all([
      DatabaseClient.getDb(),
      this.listAvailableEmbeddingModels(),
      this.getActiveEmbeddingModel(),
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
    const reportModels = [
      {
        id: RAG_HASH_EMBEDDING_MODEL_ID,
        title: `Ark hash fallback (${RAG_HASH_EMBEDDING_DIMENSIONS}d)`,
        installed: true,
      },
      ...models.map((model) => ({
        id: model.id,
        title: model.title,
        installed: model.installed,
      })),
    ];

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
        active:
          model.id === RAG_HASH_EMBEDDING_MODEL_ID
            ? !activeEmbedding
            : activeEmbedding?.id === model.id,
        total,
        embedded,
        complete: total === 0 ? 1 : embedded / total,
        domains: byDomain,
      };
    });
  }
}
