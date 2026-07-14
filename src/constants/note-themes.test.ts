import { describe, expect, test } from 'bun:test';
import {
  NOTE_THEME_IDS,
  NOTE_THEME_OPTIONS,
  getNoteTheme,
  isNoteThemeId,
  normalizeNoteThemeId,
} from '@/constants/note-themes';
import type { EffectiveTheme } from '@/constants/theme';

const REQUIRED_VARIANT_KEYS = [
  'background',
  'foreground',
  'mutedForeground',
  'border',
  'chipBackground',
  'chipForeground',
] as const;

describe('note themes', () => {
  test('exposes the requested semantic theme ids', () => {
    expect(NOTE_THEME_IDS).toEqual([
      'default',
      'red',
      'orange',
      'yellow',
      'green',
      'teal',
      'blue',
      'purple',
      'pink',
      'beach',
      'forest',
    ]);
    expect(NOTE_THEME_OPTIONS.map((theme) => theme.id)).toEqual(Array.from(NOTE_THEME_IDS));
  });

  test('normalizes unknown theme ids to default', () => {
    expect(isNoteThemeId('forest')).toBe(true);
    expect(isNoteThemeId('raw-hex')).toBe(false);
    expect(normalizeNoteThemeId('raw-hex')).toBe('default');
    expect(getNoteTheme('raw-hex', 'oled')).toEqual(getNoteTheme('default', 'oled'));
  });

  test('defines complete variants for every app theme', () => {
    const appThemes: EffectiveTheme[] = ['oled', 'dark', 'light'];

    for (const noteThemeId of NOTE_THEME_IDS) {
      for (const appTheme of appThemes) {
        const variant = getNoteTheme(noteThemeId, appTheme);
        for (const key of REQUIRED_VARIANT_KEYS) {
          expect(variant[key]).toMatch(/^#[0-9A-F]{6}$/i);
        }
      }
    }
  });
});
