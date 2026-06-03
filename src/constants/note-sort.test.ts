import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_NOTE_SORT_MODE,
  NOTE_SORT_MODES,
  getNoteSortLabel,
  normalizeNoteSortMode,
} from '@/constants/note-sort';

describe('note sort modes', () => {
  test('defines the requested notes sort modes', () => {
    expect(NOTE_SORT_MODES).toEqual(['manual', 'updated_desc', 'updated_asc', 'title']);
  });

  test('normalizes unknown sort modes to the default', () => {
    expect(DEFAULT_NOTE_SORT_MODE).toBe('updated_desc');
    expect(normalizeNoteSortMode('manual')).toBe('manual');
    expect(normalizeNoteSortMode('random')).toBe('updated_desc');
    expect(getNoteSortLabel('title')).toBe('Title');
  });
});
