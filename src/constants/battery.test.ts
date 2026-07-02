import { describe, expect, test } from 'bun:test';
import {
  BATTERY_POLL_INTERVALS_MS,
  BATTERY_REDUCE_MODE_KEY,
  BATTERY_SENSOR_INTERVALS_MS,
  reducedInterval,
} from '@/constants/battery';

describe('battery reduce mode constants', () => {
  test('uses the persisted release key', () => {
    expect(BATTERY_REDUCE_MODE_KEY).toBe('battery.reduceModeEnabled');
  });

  test('slows live sensor and polling intervals in reduce mode', () => {
    for (const interval of Object.values(BATTERY_SENSOR_INTERVALS_MS)) {
      expect(interval.reduced).toBeGreaterThan(interval.normal);
    }
    for (const interval of Object.values(BATTERY_POLL_INTERVALS_MS)) {
      expect(interval.reduced).toBeGreaterThan(interval.normal);
    }
    expect(reducedInterval('compass', true)).toBe(BATTERY_SENSOR_INTERVALS_MS.compass.reduced);
    expect(reducedInterval('compass', false)).toBe(BATTERY_SENSOR_INTERVALS_MS.compass.normal);
  });
});
