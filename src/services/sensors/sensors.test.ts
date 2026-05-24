import { describe, expect, mock, test } from 'bun:test';

mock.module('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: async () => true,
    setUpdateInterval: () => undefined,
    addListener: () => ({ remove: () => undefined }),
  },
  Magnetometer: {
    isAvailableAsync: async () => true,
    setUpdateInterval: () => undefined,
    addListener: () => ({ remove: () => undefined }),
  },
}));

describe('sensor calculations', () => {
  test('compass heading keeps west/east oriented to the device top edge', async () => {
    const { calculateCompassReading } = await import('@/services/sensors/compass.service');

    expect(Math.round(calculateCompassReading({ x: 0, y: 1, z: 0 }).heading)).toBe(0);
    expect(Math.round(calculateCompassReading({ x: -1, y: 0, z: 0 }).heading)).toBe(90);
    expect(Math.round(calculateCompassReading({ x: 0, y: -1, z: 0 }).heading)).toBe(180);
    expect(Math.round(calculateCompassReading({ x: 1, y: 0, z: 0 }).heading)).toBe(270);
    expect(calculateCompassReading({ x: 3, y: 4, z: 12 }).fieldStrength).toBe(13);
  });

  test('level switches between flat ball mode and upright ruler mode', async () => {
    const { calculateLevelReading } = await import('@/services/sensors/level.service');

    const flat = calculateLevelReading({ x: 0.08, y: -0.04, z: 0.99 });
    const uprightPortrait = calculateLevelReading({ x: 0.04, y: 0.98, z: 0.12 });
    const uprightLandscape = calculateLevelReading({ x: 0.98, y: 0.04, z: 0.12 });

    expect(flat.mode).toBe('flat');
    expect(Math.abs(flat.pitch)).toBeLessThan(5);
    expect(Math.abs(flat.roll)).toBeLessThan(5);
    expect(uprightPortrait.mode).toBe('upright');
    expect(uprightPortrait.tubeAxis).toBe('portrait');
    expect(uprightLandscape.mode).toBe('upright');
    expect(uprightLandscape.tubeAxis).toBe('landscape');
  });
});
