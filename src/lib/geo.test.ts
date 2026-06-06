import { describe, expect, test } from 'bun:test';
import { formatPoint, haversineMeters, toRadians } from './geo';

describe('geo utilities', () => {
  test('toRadians converts degrees to radians', () => {
    expect(toRadians(0)).toBe(0);
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
    expect(toRadians(-45)).toBeCloseTo(-Math.PI / 4, 10);
  });

  test('haversineMeters is zero for identical points', () => {
    expect(haversineMeters(0, 0, 0, 0)).toBe(0);
    expect(haversineMeters(38.7, -9.1, 38.7, -9.1)).toBe(0);
  });

  test('haversineMeters matches known great-circle distances', () => {
    const lisbon = [38.7223, -9.1393] as const;
    const porto = [41.1579, -8.6291] as const;
    const madrid = [40.4168, -3.7038] as const;

    const lisbonPorto = haversineMeters(...lisbon, ...porto);
    const lisbonMadrid = haversineMeters(...lisbon, ...madrid);

    expect(lisbonPorto).toBeGreaterThan(270_000);
    expect(lisbonPorto).toBeLessThan(280_000);
    expect(lisbonMadrid).toBeGreaterThan(500_000);
    expect(lisbonMadrid).toBeLessThan(510_000);
  });

  test('haversineMeters is symmetric', () => {
    const distanceAB = haversineMeters(38.7, -9.1, 40.4, -3.7);
    const distanceBA = haversineMeters(40.4, -3.7, 38.7, -9.1);
    expect(distanceAB).toBeCloseTo(distanceBA, 6);
  });

  test('formatPoint uses 5 decimal places', () => {
    expect(formatPoint(0, 0)).toBe('0.00000, 0.00000');
    expect(formatPoint(38.7, -9.1)).toBe('38.70000, -9.10000');
    expect(formatPoint(-23.55052, -46.633308)).toBe('-23.55052, -46.63331');
  });
});
