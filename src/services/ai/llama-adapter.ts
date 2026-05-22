import type { AiAdapterResponse } from '@/types/ai';

export class LlamaAdapter {
  readonly id = 'llama-unavailable';

  isAvailable() {
    return false;
  }

  async sendMessage(): Promise<AiAdapterResponse> {
    return {
      content:
        'llama.rn / @react-native-ai/llama is not active in this Expo Go build. Install a native dev build and wire this adapter to enable on-device models.',
      citations: [],
    };
  }
}
