import type { AiRuntimeAdapter } from '@/types/ai';

export function resolveAiRuntimeAdapter(input: {
  moduleAvailable: boolean;
  modelUri: string | null | undefined;
  installedChatModels: number;
}): AiRuntimeAdapter {
  if (input.moduleAvailable && input.modelUri) return 'llama';
  if (input.installedChatModels > 0 && !input.moduleAvailable) return 'llama-unavailable';
  return 'mock';
}
