import { describe, expect, test } from 'bun:test';
import { getNotePlainText } from '@/lib/note-text';

describe('note plain text extraction', () => {
  test('prefers rich JSON text over placeholder editor artifacts', () => {
    const contentJson = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Filter water before storage.' }],
        },
      ],
    });

    expect(
      getNotePlainText({
        body: '...',
        contentHtml: '<p>Filter water before storage.</p>',
        contentJson,
      })
    ).toBe('Filter water before storage.');
  });

  test('falls back to readable HTML without preserving markup', () => {
    expect(
      getNotePlainText({
        body: '',
        contentHtml: '<p><strong>Radio</strong> check</p><ul><li>Charge batteries</li></ul>',
        contentJson: null,
      })
    ).toBe('Radio check\n- Charge batteries');
  });
});
