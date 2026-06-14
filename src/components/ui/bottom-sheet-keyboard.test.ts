import { describe, expect, test } from 'bun:test';
import { resolveKeyboardOffset } from '@/components/ui/bottom-sheet-keyboard';

describe('resolveKeyboardOffset', () => {
  test('returns 0 for a missing event (Android edge case)', () => {
    expect(resolveKeyboardOffset(undefined, 800)).toBe(0);
  });

  test('returns 0 for an event with no endCoordinates', () => {
    expect(resolveKeyboardOffset({}, 800)).toBe(0);
  });

  test('uses event.height when screenY is not provided', () => {
    expect(resolveKeyboardOffset({ endCoordinates: { height: 320 } }, 800)).toBe(320);
  });

  test('uses event.height when Android reports screenY as 0', () => {
    expect(resolveKeyboardOffset({ endCoordinates: { height: 320, screenY: 0 } }, 800)).toBe(320);
  });

  test('uses windowHeight - screenY when screenY is provided (iOS path)', () => {
    // iOS reports the keyboard top as screenY; the offset is the space below it.
    expect(resolveKeyboardOffset({ endCoordinates: { height: 336, screenY: 464 } }, 800)).toBe(
      800 - 464
    );
  });

  test('clamps negative offsets to 0', () => {
    expect(resolveKeyboardOffset({ endCoordinates: { screenY: 1000 } }, 800)).toBe(0);
  });

  test('falls back to 0 when height is missing and no screenY', () => {
    expect(resolveKeyboardOffset({ endCoordinates: {} }, 800)).toBe(0);
  });
});
