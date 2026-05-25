import { describe, expect, test } from 'bun:test';
import { normalizeAssistantTurn, stripHiddenModelOutput } from '@/services/ai/response-normalizer';

describe('AI response normalizer', () => {
  test('prefers parsed llama.rn content and keeps reasoning separate', () => {
    const turn = normalizeAssistantTurn({
      text: '<think>draft</think>Final answer',
      content: 'Final answer',
      reasoning_content: 'draft',
      tool_calls: [
        {
          id: 'call-1',
          function: {
            name: 'search_local_knowledge',
            arguments: '{"query":"water storage","limit":3}',
          },
        },
      ],
    });

    expect(turn.content).toBe('Final answer');
    expect(turn.reasoning).toBe('draft');
    expect(turn.toolCalls).toEqual([
      {
        id: 'call-1',
        name: 'search_local_knowledge',
        arguments: { query: 'water storage', limit: 3 },
      },
    ]);
  });

  test('strips leaked thinking and Gemma channel markers from visible content', () => {
    expect(stripHiddenModelOutput('<think>private chain</think>\nKeep water sealed.')).toBe(
      'Keep water sealed.'
    );
    expect(
      stripHiddenModelOutput('<|channel>thought\nprivate plan<channel|><|channel>final\nMove uphill.')
    ).toBe('Move uphill.');
  });
});
