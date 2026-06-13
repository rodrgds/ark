import { describe, expect, test } from 'bun:test';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';

describe('AI reasoning normalizer', () => {
  test('separates think tags from visible content', () => {
    expect(normalizeReasoningOutput('<think>private plan</think>Filter water.')).toEqual({
      content: 'Filter water.',
      reasoning: 'private plan',
    });
  });

  test('separates Gemma channel thought and final blocks', () => {
    expect(
      normalizeReasoningOutput(
        '<|channel>thought\nprivate plan<channel|><|channel>final\nMove uphill.'
      )
    ).toEqual({
      content: 'Move uphill.',
      reasoning: 'private plan',
    });
  });

  test('handles alternate channel token spelling', () => {
    expect(
      normalizeReasoningOutput(
        '<|channel|>analysis\nprivate plan\n<|channel|>final\nMake a hook from wire.'
      )
    ).toEqual({
      content: 'Make a hook from wire.',
      reasoning: 'private plan',
    });
  });

  test('keeps unfinished reasoning out of visible output while streaming', () => {
    expect(normalizeReasoningOutput('<|channel>thought\nprivate partial')).toEqual({
      content: '',
      reasoning: 'private partial',
    });
  });

  test('recovers final text from an unclosed think block only when requested', () => {
    const output = '<think>private plan\nFinal answer:\nFilter water through cloth first.';

    expect(normalizeReasoningOutput(output)).toEqual({
      content: '',
      reasoning: 'private plan Final answer: Filter water through cloth first.',
    });
    expect(normalizeReasoningOutput(output, { recoverFinalFromUnclosedReasoning: true })).toEqual({
      content: 'Filter water through cloth first.',
      reasoning: 'private plan',
    });
  });
});
