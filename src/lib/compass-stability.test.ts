import { describe, expect, test } from 'bun:test';
import { circularSpreadDeg } from '@/lib/compass-stability';

describe('circularSpreadDeg', () => {
  test('returns 0 for a single sample', () => {
    expect(circularSpreadDeg([45])).toBe(0);
  });

  test('returns 0 for a single point repeated', () => {
    expect(circularSpreadDeg([90, 90, 90, 90])).toBe(0);
  });

  test('returns the arc span for points clustered within a few degrees', () => {
    expect(circularSpreadDeg([10, 11, 12, 13])).toBe(3);
  });

  test('handles the wraparound case (350° vs 10° is 20°, not 340°)', () => {
    const spread = circularSpreadDeg([350, 355, 0, 5, 10]);
    expect(spread).toBeLessThan(25);
    expect(spread).toBeGreaterThan(15);
  });

  test('returns 180° for two opposite points', () => {
    expect(circularSpreadDeg([0, 180])).toBeCloseTo(180, 0);
  });

  test('returns the smallest arc covering clustered points', () => {
    const spread = circularSpreadDeg([10, 60, 110]);
    expect(spread).toBeGreaterThan(95);
    expect(spread).toBeLessThan(105);
  });

  test('returns 270° when points span 3/4 of the circle', () => {
    const spread = circularSpreadDeg([10, 100, 190, 280]);
    expect(spread).toBeGreaterThan(265);
    expect(spread).toBeLessThan(275);
  });
});
