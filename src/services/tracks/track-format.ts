import {
  DEFAULT_RATE_MODE,
  DEFAULT_TRACK_ACTIVITY,
  DEFAULT_UNIT_SYSTEM,
  TRACK_ACTIVITIES,
} from '@/constants/tracks';
import type { RateDisplayMode, TrackActivityType, UnitSystem } from '@/types/tracks';

const METERS_PER_MILE = 1609.344;
const METERS_PER_NAUTICAL_MILE = 1852;
const FEET_PER_METER = 3.28084;

export function isUnitSystem(value: string | null): value is UnitSystem {
  return value === 'metric' || value === 'imperial' || value === 'nautical';
}

export function isRateDisplayMode(value: string | null): value is RateDisplayMode {
  return value === 'activity' || value === 'speed' || value === 'pace';
}

export function isTrackActivityType(value: string | null): value is TrackActivityType {
  return TRACK_ACTIVITIES.some((activity) => activity.id === value);
}

export function normalizeUnitSystem(value: string | null): UnitSystem {
  return isUnitSystem(value) ? value : DEFAULT_UNIT_SYSTEM;
}

export function normalizeRateDisplayMode(value: string | null): RateDisplayMode {
  return isRateDisplayMode(value) ? value : DEFAULT_RATE_MODE;
}

export function normalizeTrackActivity(value: string | null): TrackActivityType {
  return isTrackActivityType(value) ? value : DEFAULT_TRACK_ACTIVITY;
}

export function resolveRateMode(
  activityType: TrackActivityType,
  preference: RateDisplayMode
): Exclude<RateDisplayMode, 'activity'> {
  if (preference !== 'activity') return preference;
  return (
    TRACK_ACTIVITIES.find((activity) => activity.id === activityType)?.defaultRateMode ?? 'speed'
  );
}

export function formatDuration(
  totalSeconds: number | null | undefined,
  options?: { compact?: boolean }
) {
  const seconds = Math.max(0, Math.round(totalSeconds ?? 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (options?.compact) {
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }
  return [hours, minutes, remainingSeconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

export function distanceUnit(unitSystem: UnitSystem, meters: number) {
  if (unitSystem === 'metric') {
    return meters >= 1000
      ? { value: meters / 1000, unit: 'km', precision: meters >= 10_000 ? 1 : 2 }
      : { value: meters, unit: 'm', precision: 0 };
  }
  if (unitSystem === 'nautical') {
    return {
      value: meters / METERS_PER_NAUTICAL_MILE,
      unit: 'nmi',
      precision: meters >= 10 * METERS_PER_NAUTICAL_MILE ? 1 : 2,
    };
  }
  const miles = meters / METERS_PER_MILE;
  return miles >= 0.1
    ? { value: miles, unit: 'mi', precision: miles >= 10 ? 1 : 2 }
    : { value: meters * FEET_PER_METER, unit: 'ft', precision: 0 };
}

export function formatDistance(meters: number | null | undefined, unitSystem: UnitSystem) {
  const distance = distanceUnit(unitSystem, Math.max(0, meters ?? 0));
  return `${distance.value.toFixed(distance.precision)} ${distance.unit}`;
}

export function elevationUnit(unitSystem: UnitSystem, meters: number) {
  if (unitSystem === 'metric') return { value: meters, unit: 'm', precision: 0 };
  return { value: meters * FEET_PER_METER, unit: 'ft', precision: 0 };
}

export function formatElevation(meters: number | null | undefined, unitSystem: UnitSystem) {
  const elevation = elevationUnit(unitSystem, meters ?? 0);
  return `${elevation.value.toFixed(elevation.precision)} ${elevation.unit}`;
}

export function speedUnit(unitSystem: UnitSystem, metersPerSecond: number) {
  if (unitSystem === 'metric') {
    return { value: metersPerSecond * 3.6, unit: 'km/h', precision: 1 };
  }
  if (unitSystem === 'nautical') {
    return { value: (metersPerSecond * 3600) / METERS_PER_NAUTICAL_MILE, unit: 'kt', precision: 1 };
  }
  return { value: (metersPerSecond * 3600) / METERS_PER_MILE, unit: 'mph', precision: 1 };
}

export function formatSpeed(metersPerSecond: number | null | undefined, unitSystem: UnitSystem) {
  const speed = speedUnit(unitSystem, Math.max(0, metersPerSecond ?? 0));
  return `${speed.value.toFixed(speed.precision)} ${speed.unit}`;
}

export function paceSecondsPerDistance(
  metersPerSecond: number | null | undefined,
  unitSystem: UnitSystem
) {
  const speed = metersPerSecond ?? 0;
  if (speed <= 0) return null;
  const distanceMeters = unitSystem === 'metric' ? 1000 : METERS_PER_MILE;
  return distanceMeters / speed;
}

export function formatPace(metersPerSecond: number | null | undefined, unitSystem: UnitSystem) {
  const pace = paceSecondsPerDistance(metersPerSecond, unitSystem);
  const unit = unitSystem === 'metric' ? 'km' : 'mi';
  if (pace == null) return `--/${unit}`;
  const minutes = Math.floor(pace / 60);
  const seconds = Math.round(pace % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/${unit}`;
}

export function formatRate(input: {
  metersPerSecond: number | null | undefined;
  unitSystem: UnitSystem;
  activityType: TrackActivityType;
  rateMode: RateDisplayMode;
}) {
  return resolveRateMode(input.activityType, input.rateMode) === 'pace'
    ? formatPace(input.metersPerSecond, input.unitSystem)
    : formatSpeed(input.metersPerSecond, input.unitSystem);
}

export function formatCoordinate(
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  if (latitude == null || longitude == null) return 'No coordinate';
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
