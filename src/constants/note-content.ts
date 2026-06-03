export const NOTE_CONTENT_FORMATS = ['plain-text', 'tiptap-json-v1'] as const;

export type NoteContentFormat = (typeof NOTE_CONTENT_FORMATS)[number];

export const DEFAULT_NOTE_CONTENT_FORMAT: NoteContentFormat = 'plain-text';
export const RICH_NOTE_CONTENT_FORMAT: NoteContentFormat = 'tiptap-json-v1';

export function normalizeNoteContentFormat(value: unknown): NoteContentFormat {
  return NOTE_CONTENT_FORMATS.includes(value as NoteContentFormat)
    ? (value as NoteContentFormat)
    : DEFAULT_NOTE_CONTENT_FORMAT;
}
