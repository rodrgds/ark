import { ContentPackService } from '@/services/content/content-pack.service';
import { LlamaAdapter } from '@/services/ai/llama-adapter';

const llamaAdapter = new LlamaAdapter();

export class ModelManagerService {
  static async listAvailableModels() {
    return (await ContentPackService.listPacks()).filter((pack) => pack.category === 'AI Models');
  }

  static async getStatus() {
    const models = await this.listAvailableModels();
    const installed = models.filter((model) => model.installed);
    const runtime = await llamaAdapter.getRuntimeStatus();
    const adapter = runtime.moduleAvailable && runtime.modelUri ? 'llama' : 'mock';

    return {
      adapter,
      installedModels: installed.length,
      availableModels: models.length,
      activeModelTitle: runtime.modelTitle,
      contextTokens: runtime.contextTokens,
      maxResponseTokens: runtime.maxResponseTokens,
      message:
        adapter === 'llama'
          ? `${runtime.modelTitle ?? 'Local model'} is ready for offline chat. Ark limits each answer to ${runtime.maxResponseTokens} tokens to protect phone memory.`
          : installed.length
            ? 'A local model file is downloaded. Open Ark in a llama.rn development build to run it fully offline.'
            : 'No local model is installed. Download a small GGUF model from Library before using offline AI.',
    };
  }
}
