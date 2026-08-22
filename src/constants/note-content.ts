export const NOTE_CONTENT_FORMATS = ['plain-text', 'tiptap-json-v1'] as const;

export type NoteContentFormat = (typeof NOTE_CONTENT_FORMATS)[number];

export const DEFAULT_NOTE_CONTENT_FORMAT: NoteContentFormat = 'plain-text';
export const RICH_NOTE_CONTENT_FORMAT: NoteContentFormat = 'tiptap-json-v1';

export function normalizeNoteContentFormat(value: string | null | undefined): NoteContentFormat {
  // SAFETY: NOTE_CONTENT_FORMATS lists every valid format id, so a match
  // proves the value is a NoteContentFormat.
  if (!(NOTE_CONTENT_FORMATS as readonly string[]).includes(value ?? '')) {
    return DEFAULT_NOTE_CONTENT_FORMAT;
  }
  // SAFETY: the includes check above proved value is a valid format id.
  return value as NoteContentFormat;
}
