import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

const AIService = {
  ensureThread: async () => '',
  sendMessage: async (_input: { content: string }) => ({ messages: [] }),
  clearThread: async (_threadId: string) => {},
};

mock.module('@/services/ai/ai.service', () => ({ AIService }));

const { AiEvaluationService } = await import('@/services/ai/ai-evaluation.service');

const spies: { mockRestore(): void }[] = [];

afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

function spy<T extends { mockRestore(): void }>(value: T): T {
  spies.push(value);
  return value;
}

function successfulResponse(prompt: string) {
  const content = prompt.includes('cloudy water')
    ? 'Filter cloudy water through cloth, then disinfect it [1].'
    : 'I cannot verify this from matching local sources.';
  const citations = prompt.includes('cloudy water')
    ? [
        {
          sourceId: 'guide:water',
          title: 'Water treatment',
          snippet: 'Filter and disinfect water.',
        },
      ]
    : [];
  return { messages: [{ role: 'assistant', content, citations }] } as never;
}

describe('AiEvaluationService cleanup', () => {
  test('removes every temporary chat after successful evaluation', async () => {
    spy(spyOn(AIService, 'ensureThread')).mockImplementation(async () => 'evaluation-thread');
    spy(spyOn(AIService, 'sendMessage')).mockImplementation(async ({ content }) =>
      successfulResponse(content)
    );
    const clearThread = spy(spyOn(AIService, 'clearThread')).mockImplementation(async () => {});

    const results = await AiEvaluationService.runAll();

    expect(results.every((result) => result.pass)).toBe(true);
    expect(clearThread).toHaveBeenCalledTimes(results.length);
  });

  test('still removes the temporary chat when evaluation fails', async () => {
    spy(spyOn(AIService, 'ensureThread')).mockImplementation(async () => 'evaluation-thread');
    spy(spyOn(AIService, 'sendMessage')).mockRejectedValue(new Error('Evaluation failed'));
    const clearThread = spy(spyOn(AIService, 'clearThread')).mockImplementation(async () => {});

    const results = await AiEvaluationService.runAll();

    expect(results.every((result) => !result.pass)).toBe(true);
    expect(results.every((result) => result.failures.includes('Evaluation failed'))).toBe(true);
    expect(clearThread).toHaveBeenCalledTimes(results.length);
  });

  test('surfaces cleanup failure instead of reporting normal completion', async () => {
    spy(spyOn(AIService, 'ensureThread')).mockImplementation(async () => 'evaluation-thread');
    spy(spyOn(AIService, 'sendMessage')).mockImplementation(async ({ content }) =>
      successfulResponse(content)
    );
    spy(spyOn(AIService, 'clearThread')).mockRejectedValue(new Error('Database is locked'));

    const results = await AiEvaluationService.runAll();

    expect(results.every((result) => !result.pass)).toBe(true);
    expect(
      results.every((result) =>
        result.failures.includes('Temporary evaluation chat cleanup failed: Database is locked')
      )
    ).toBe(true);
  });
});
