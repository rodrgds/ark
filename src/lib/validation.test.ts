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
      contentHtml: null,
      contentJson: null,
      contentFormat: 'plain-text',
      tags: ['water', 'camp'],
      themeId: 'default',
    });
  });

  test('note patches do not default omitted fields', () => {
    expect(parseOrThrow(notePatchSchema, { tags: [' field '] })).toEqual({
      tags: ['field'],
    });
    expect(parseOrThrow(notePatchSchema, { body: 'Keep body' })).toEqual({
      body: 'Keep body',
    });
    expect(
      parseOrThrow(notePatchSchema, {
        contentHtml: '<p><strong>Keep body</strong></p>',
        contentJson: '{"type":"doc"}',
        contentFormat: 'tiptap-json-v1',
      })
    ).toEqual({
      contentHtml: '<p><strong>Keep body</strong></p>',
      contentJson: '{"type":"doc"}',
      contentFormat: 'tiptap-json-v1',
    });
  });

  test('rejects empty chat messages', () => {
    expect(() => parseOrThrow(chatMessageSchema, { content: '   ', useRag: true })).toThrow(
      'Message cannot be empty.'
    );
  });

  test('accepts bounded chat attachments', () => {
    const parsed = parseOrThrow(chatMessageSchema, {
      content: 'Summarize this.',
      useRag: true,
      attachments: [
        {
          type: 'note',
          title: '  Water plan  ',
          content: 'Boil and seal.',
          sourceId: 'note-1',
        },
        {
          type: 'image',
          title: 'Filter label',
          uri: 'file:///ark/filter.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    });

    expect(parsed.attachments?.[0]).toMatchObject({ title: 'Water plan' });
    expect(parsed.attachments?.[1]).toMatchObject({ mimeType: 'image/jpeg' });
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
