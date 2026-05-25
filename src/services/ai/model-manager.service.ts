import { ContentPackService } from '@/services/content/content-pack.service';
import { isEmbeddingModelPack } from '@/services/ai/embedding-models';
import { resetEmbeddingRuntimeContext } from '@/services/ai/embedding.service';
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
    return (await this.listAvailableModels()).filter((model) => !isEmbeddingModelPack(model));
  }

  static async listAvailableEmbeddingModels() {
    return (await this.listAvailableModels()).filter((model) => isEmbeddingModelPack(model));
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

  static async getPreferences() {
    const [
      modelPickerEnabled,
      selectedModelId,
      selectedEmbeddingModelId,
      chatModelDisabled,
      interfaceMode,
    ] = await Promise.all([
      PreferencesService.getAiModelPickerEnabled(),
      PreferencesService.getSelectedAiModelId(),
      PreferencesService.getSelectedEmbeddingModelId(),
      PreferencesService.getAiChatModelDisabled(),
      PreferencesService.getInterfaceMode(),
    ]);
    return {
      modelPickerEnabled,
      selectedModelId,
      selectedEmbeddingModelId,
      chatModelDisabled,
      interfaceMode,
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

  static async setChatModelDisabled(disabled: boolean) {
    await PreferencesService.setAiChatModelDisabled(disabled);
    if (disabled) {
      await PreferencesService.setSelectedAiModelId(null);
    }
    resetLlamaRuntimeContext();
  }

  static async getStatus() {
    const [models, chatModels, embeddingModels] = await Promise.all([
      this.listAvailableModels(),
      this.listAvailableChatModels(),
      this.listAvailableEmbeddingModels(),
    ]);
    const installedChatModels = chatModels.filter((model) => model.installed);
    const installedEmbeddingModels = embeddingModels.filter((model) => model.installed);
    const runtime = await llamaAdapter.getRuntimeStatus();
    const adapter = runtime.moduleAvailable && runtime.modelUri ? 'llama' : 'mock';
    const preferences = await this.getPreferences();

    return {
      adapter,
      installedModels: installedChatModels.length,
      installedChatModels: installedChatModels.length,
      installedEmbeddingModels: installedEmbeddingModels.length,
      availableModels: models.length,
      availableChatModels: chatModels.length,
      availableEmbeddingModels: embeddingModels.length,
      selectedModelId: preferences.selectedModelId,
      selectedEmbeddingModelId: preferences.selectedEmbeddingModelId,
      modelPickerEnabled: preferences.modelPickerEnabled,
      chatModelDisabled: preferences.chatModelDisabled,
      interfaceMode: preferences.interfaceMode,
      activeModelTitle: runtime.modelTitle,
      contextTokens: runtime.contextTokens,
      maxResponseTokens: runtime.maxResponseTokens,
      message: preferences.chatModelDisabled
        ? 'Chat model is disabled. Ask Arky will use local source search only.'
        : adapter === 'llama'
          ? `${runtime.modelTitle ?? 'Local model'} is ready for offline chat. Ark limits each answer to ${runtime.maxResponseTokens} tokens to protect phone memory.`
          : installedChatModels.length
            ? 'A chat model file is downloaded. Use a build with local AI enabled to run it fully offline.'
            : 'No chat model is installed. Add a chat GGUF in Settings > AI before using offline AI.',
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
