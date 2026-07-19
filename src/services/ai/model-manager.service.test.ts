import { describe, expect, test } from 'bun:test';
import { resolveAiRuntimeAdapter } from '@/services/ai/model-runtime';

describe('resolveAiRuntimeAdapter', () => {
  test('reports llama only when the native runtime and model are both available', () => {
    expect(
      resolveAiRuntimeAdapter({
        moduleAvailable: true,
        modelUri: 'file:///ark/models/model.gguf',
        installedChatModels: 1,
      })
    ).toBe('llama');
  });

  test('distinguishes installed models from a missing native runtime', () => {
    expect(
      resolveAiRuntimeAdapter({
        moduleAvailable: false,
        modelUri: 'file:///ark/models/model.gguf',
        installedChatModels: 1,
      })
    ).toBe('llama-unavailable');
  });

  test('uses the mock adapter when no answer model is installed', () => {
    expect(
      resolveAiRuntimeAdapter({
        moduleAvailable: false,
        modelUri: null,
        installedChatModels: 0,
      })
    ).toBe('mock');
  });
});
