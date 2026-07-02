export const BATTERY_REDUCE_MODE_KEY = 'battery.reduceModeEnabled';

export const BATTERY_SENSOR_INTERVALS_MS = {
  compass: { normal: 100, reduced: 500 },
  level: { normal: 60, reduced: 250 },
  barometer: { normal: 1000, reduced: 5000 },
  light: { normal: 1000, reduced: 5000 },
  pedometerPoll: { normal: 2000, reduced: 10000 },
} as const;

export const BATTERY_POLL_INTERVALS_MS = {
  settingsRefresh: { normal: 1000, reduced: 5000 },
  toolsOverview: { normal: 10000, reduced: 60000 },
  chatModelRefresh: { normal: 8000, reduced: 30000 },
  weatherRefresh: { normal: 30 * 60 * 1000, reduced: 2 * 60 * 60 * 1000 },
  newsRefresh: { normal: 30 * 60 * 1000, reduced: 2 * 60 * 60 * 1000 },
} as const;

export function reducedInterval<T extends keyof typeof BATTERY_SENSOR_INTERVALS_MS>(
  key: T,
  reduceModeEnabled?: boolean
) {
  return BATTERY_SENSOR_INTERVALS_MS[key][reduceModeEnabled ? 'reduced' : 'normal'];
}
