import { describe, expect, test } from 'bun:test';
import { inferUnitSystemFromLocales } from '@/services/preferences/field-preferences-defaults';

describe('field preference defaults', () => {
  test('uses metric when the locale reports metric measurement', () => {
    expect(
      inferUnitSystemFromLocales([
        { languageTag: 'pt-PT', measurementSystem: 'metric', regionCode: 'PT' },
      ])
    ).toBe('metric');
  });

  test('uses imperial for US and UK-style measurement systems', () => {
    expect(
      inferUnitSystemFromLocales([
        { languageTag: 'en-US', measurementSystem: 'us', regionCode: 'US' },
      ])
    ).toBe('imperial');
    expect(
      inferUnitSystemFromLocales([
        { languageTag: 'en-GB', measurementSystem: 'uk', regionCode: 'GB' },
      ])
    ).toBe('imperial');
  });

  test('falls back to region when measurement system is missing', () => {
    expect(inferUnitSystemFromLocales([{ languageTag: 'en-US', regionCode: 'US' }])).toBe(
      'imperial'
    );
    expect(inferUnitSystemFromLocales([{ languageTag: 'pt-PT', regionCode: 'PT' }])).toBe('metric');
  });

  test('falls back to metric when no locale signal is available', () => {
    expect(inferUnitSystemFromLocales([])).toBe('metric');
  });
});
