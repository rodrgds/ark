import type {
  RateDisplayMode,
  TrackActivityType,
  TrackMarkerType,
  TrackRecordingProfile,
  UnitSystem,
} from '@/types/tracks';

export type TrackActivityDefinition = {
  id: TrackActivityType;
  label: string;
  shortLabel: string;
  description: string;
  defaultRateMode: Exclude<RateDisplayMode, 'activity'>;
};

export const TRACK_ACTIVITIES: TrackActivityDefinition[] = [
  {
    id: 'walk',
    label: 'Walk',
    shortLabel: 'Walk',
    description: 'Low-speed movement through streets, paths, or camps.',
    defaultRateMode: 'pace',
  },
  {
    id: 'hike',
    label: 'Hike',
    shortLabel: 'Hike',
    description: 'Trail movement where elevation and breaks matter.',
    defaultRateMode: 'pace',
  },
  {
    id: 'run',
    label: 'Run',
    shortLabel: 'Run',
    description: 'Faster foot travel with pace-focused stats.',
    defaultRateMode: 'pace',
  },
  {
    id: 'cycle',
    label: 'Cycle',
    shortLabel: 'Bike',
    description: 'Bicycle travel where speed over distance matters.',
    defaultRateMode: 'speed',
  },
  {
    id: 'drive',
    label: 'Drive',
    shortLabel: 'Drive',
    description: 'Vehicle movement with wider sampling tolerance.',
    defaultRateMode: 'speed',
  },
  {
    id: 'paddle',
    label: 'Paddle',
    shortLabel: 'Paddle',
    description: 'Water travel with speed and route markers.',
    defaultRateMode: 'speed',
  },
  {
    id: 'scout',
    label: 'Scout',
    shortLabel: 'Scout',
    description: 'Slow survey movement with markers and photos.',
    defaultRateMode: 'speed',
  },
  {
    id: 'other',
    label: 'Other',
    shortLabel: 'Other',
    description: 'Manual field recording when the activity is mixed.',
    defaultRateMode: 'speed',
  },
];

export const TRACK_ACTIVITY_IDS = TRACK_ACTIVITIES.map((activity) => activity.id);

export const TRACK_MARKER_TYPES: Array<{
  id: TrackMarkerType;
  label: string;
  description: string;
}> = [
  { id: 'interesting', label: 'Interesting', description: 'Worth checking again.' },
  { id: 'camp', label: 'Camp', description: 'Rest, shelter, or overnight point.' },
  { id: 'water', label: 'Water', description: 'Water source or crossing.' },
  { id: 'hazard', label: 'Hazard', description: 'Obstacle, risk, or caution point.' },
  { id: 'photo', label: 'Photo', description: 'Photo attached to this track.' },
  { id: 'custom', label: 'Custom', description: 'General track marker.' },
];

export const UNIT_OPTIONS: Array<{
  value: UnitSystem;
  label: string;
  description: string;
}> = [
  {
    value: 'metric',
    label: 'Metric',
    description: 'Kilometers, meters, and km/h.',
  },
  {
    value: 'imperial',
    label: 'Imperial',
    description: 'Miles, feet, and mph.',
  },
  {
    value: 'nautical',
    label: 'Nautical',
    description: 'Nautical miles, feet, and knots.',
  },
];

export const RATE_MODE_OPTIONS: Array<{
  value: RateDisplayMode;
  label: string;
  description: string;
}> = [
  {
    value: 'activity',
    label: 'By activity',
    description: 'Pace for foot travel, speed for wheels, water, and scouting.',
  },
  {
    value: 'speed',
    label: 'Speed',
    description: 'Show movement as distance per hour.',
  },
  {
    value: 'pace',
    label: 'Pace',
    description: 'Show movement as time per distance.',
  },
];

export const RECORDING_PROFILE_OPTIONS: Array<{
  value: TrackRecordingProfile;
  label: string;
  description: string;
}> = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Balanced route detail and battery use.',
  },
  {
    value: 'conserve',
    label: 'Conserve',
    description: 'Fewer GPS writes for long recordings.',
  },
  {
    value: 'precision',
    label: 'Precision',
    description: 'More frequent samples for short critical tracks.',
  },
];

export const TRACK_RECORDING_PROFILES: Record<
  TrackRecordingProfile,
  {
    distanceIntervalMeters: number;
    timeIntervalMs: number;
    deferredDistanceMeters: number;
    deferredIntervalMs: number;
    maxHorizontalAccuracyMeters: number;
    maxGapMeters: number;
    idleAfterSeconds: number;
  }
> = {
  normal: {
    distanceIntervalMeters: 10,
    timeIntervalMs: 5_000,
    deferredDistanceMeters: 50,
    deferredIntervalMs: 30_000,
    maxHorizontalAccuracyMeters: 100,
    maxGapMeters: 200,
    idleAfterSeconds: 10 * 60,
  },
  conserve: {
    distanceIntervalMeters: 25,
    timeIntervalMs: 15_000,
    deferredDistanceMeters: 100,
    deferredIntervalMs: 60_000,
    maxHorizontalAccuracyMeters: 200,
    maxGapMeters: 260,
    idleAfterSeconds: 12 * 60,
  },
  precision: {
    distanceIntervalMeters: 5,
    timeIntervalMs: 2_000,
    deferredDistanceMeters: 20,
    deferredIntervalMs: 12_000,
    maxHorizontalAccuracyMeters: 60,
    maxGapMeters: 150,
    idleAfterSeconds: 8 * 60,
  },
};

export const DEFAULT_TRACK_ACTIVITY: TrackActivityType = 'hike';
export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';
export const DEFAULT_RATE_MODE: RateDisplayMode = 'activity';
export const DEFAULT_RECORDING_PROFILE: TrackRecordingProfile = 'normal';
