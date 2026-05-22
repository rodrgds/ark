export class ModelManagerService {
  static getStatus() {
    return {
      adapter: 'mock',
      message: 'No local model is installed. Model downloads are intentionally manual.',
    };
  }
}
