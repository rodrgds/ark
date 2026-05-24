import { ContentPackService } from '@/services/content/content-pack.service';
import { isEmbeddingModelPack } from '@/services/ai/embedding-models';
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
    const installed = await this.listInstalledChatModels();
    const selectedId = await PreferencesService.getSelectedAiModelId();
    return installed.find((model) => model.id === selectedId) ?? installed[0] ?? null;
  }

  static async getPreferences() {
    const [modelPickerEnabled, selectedModelId] = await Promise.all([
      PreferencesService.getAiModelPickerEnabled(),
      PreferencesService.getSelectedAiModelId(),
    ]);
    return { modelPickerEnabled, selectedModelId };
  }

  static async setModelPickerEnabled(enabled: boolean) {
    await PreferencesService.setAiModelPickerEnabled(enabled);
  }

  static async setSelectedModel(modelId: string | null) {
    if (modelId) {
      const model = (await this.listAvailableChatModels()).find((item) => item.id === modelId);
      if (!model) throw new Error('Choose a chat model. Search models cannot be used for chat.');
    }
    await PreferencesService.setSelectedAiModelId(modelId);
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
      modelPickerEnabled: preferences.modelPickerEnabled,
      activeModelTitle: runtime.modelTitle,
      contextTokens: runtime.contextTokens,
      maxResponseTokens: runtime.maxResponseTokens,
      message:
        adapter === 'llama'
          ? `${runtime.modelTitle ?? 'Local model'} is ready for offline chat. Ark limits each answer to ${runtime.maxResponseTokens} tokens to protect phone memory.`
          : installedChatModels.length
            ? 'A chat model file is downloaded. Use a build with local AI enabled to run it fully offline.'
            : 'No chat model is installed. Add a chat GGUF in Settings > AI before using offline AI.',
    };
  }
}
