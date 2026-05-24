import { describe, expect, test } from 'bun:test';
import {
  chatMessageSchema,
  contentPackIdSchema,
  noteInputSchema,
  notePatchSchema,
  parseOrThrow,
  vaultPasswordSchema,
} from '@/lib/validation';

describe('validation schemas', () => {
  test('normalizes note input without accepting unbounded tags', () => {
    const parsed = parseOrThrow(noteInputSchema, {
      title: '  Field note  ',
      body: 'Water source north of camp.',
      tags: [' water ', 'camp'],
    });

    expect(parsed).toEqual({
      title: 'Field note',
      body: 'Water source north of camp.',
      tags: ['water', 'camp'],
    });
  });

  test('note patches do not default omitted fields', () => {
    expect(parseOrThrow(notePatchSchema, { tags: [' field '] })).toEqual({
      tags: ['field'],
    });
    expect(parseOrThrow(notePatchSchema, { body: 'Keep body' })).toEqual({
      body: 'Keep body',
    });
  });

  test('rejects empty chat messages', () => {
    expect(() => parseOrThrow(chatMessageSchema, { content: '   ', useRag: true })).toThrow(
      'Message cannot be empty.'
    );
  });

  test('requires vault passphrases to meet the minimum length', () => {
    expect(() => parseOrThrow(vaultPasswordSchema, 'short')).toThrow(
      'Use at least 8 characters for the vault passphrase.'
    );
  });

  test('accepts compact content pack ids only', () => {
    expect(parseOrThrow(contentPackIdSchema, 'wikipedia-simple-mini')).toBe(
      'wikipedia-simple-mini'
    );
    expect(() => parseOrThrow(contentPackIdSchema, '')).toThrow();
  });
});
