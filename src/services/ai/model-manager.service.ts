import { ContentPackService } from '@/services/content/content-pack.service';

export class ModelManagerService {
  static async listAvailableModels() {
    return (await ContentPackService.listPacks()).filter((pack) => pack.category === 'AI Models');
  }

  static async getStatus() {
    const models = await this.listAvailableModels();
    const installed = models.filter((model) => model.installed);
    return {
      adapter: 'mock',
      installedModels: installed.length,
      availableModels: models.length,
      message: installed.length
        ? 'Local model file is downloaded. Runtime loading still requires llama.rn in a development build.'
        : 'No local model is installed. Download a GGUF model from Library, then use a development build with llama.rn.',
    };
  }
}
