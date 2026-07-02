import type { RouteCoordinate } from '@/types/maps';

export type TrackActivityType =
  | 'walk'
  | 'hike'
  | 'run'
  | 'cycle'
  | 'drive'
  | 'paddle'
  | 'scout'
  | 'other';

export type UnitSystem = 'metric' | 'imperial' | 'nautical';
export type RateDisplayMode = 'activity' | 'speed' | 'pace';
export type TrackRecordingProfile = 'normal' | 'conserve' | 'precision';

export type TrackStatus = 'recording' | 'paused' | 'finished' | 'discarded';
export type TrackPointKind = 'start' | 'sample' | 'pause' | 'resume' | 'stop' | 'idle';
export type TrackMarkerType = 'interesting' | 'camp' | 'water' | 'hazard' | 'photo' | 'custom';
export type TrackAltitudeSource = 'gps' | 'barometer' | 'unknown';

export type Track = {
  id: string;
  title: string;
  description: string | null;
  activityType: TrackActivityType;
  status: TrackStatus;
  startedAt: number;
  endedAt: number | null;
  timezoneOffsetMinutes: number;
  distanceMeters: number;
  totalTimeSeconds: number;
  movingTimeSeconds: number;
  averageSpeedMps: number | null;
  averageMovingSpeedMps: number | null;
  maxSpeedMps: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  sampleCount: number;
  markerCount: number;
  recordingGapCount: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type TrackPoint = {
  id: string;
  trackId: string;
  segmentIndex: number;
  pointIndex: number;
  kind: TrackPointKind;
  latitude: number | null;
  longitude: number | null;
  altitudeMeters: number | null;
  altitudeSource: TrackAltitudeSource;
  pressureHpa: number | null;
  horizontalAccuracyMeters: number | null;
  verticalAccuracyMeters: number | null;
  speedMps: number | null;
  bearingDegrees: number | null;
  distanceFromPreviousMeters: number;
  elapsedSeconds: number;
  movingElapsedSeconds: number;
  recordedAt: number;
  createdAt: number;
};

export type TrackPointDraft = Omit<TrackPoint, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};

export type TrackMarker = {
  id: string;
  trackId: string;
  mapMarkerId: string | null;
  title: string;
  description: string | null;
  markerType: TrackMarkerType;
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  recordedAt: number;
  elapsedSeconds: number;
  distanceMeters: number;
  photoUri: string | null;
  createdAt: number;
  updatedAt: number;
};

export type TrackStats = Pick<
  Track,
  | 'distanceMeters'
  | 'totalTimeSeconds'
  | 'movingTimeSeconds'
  | 'averageSpeedMps'
  | 'averageMovingSpeedMps'
  | 'maxSpeedMps'
  | 'elevationGainMeters'
  | 'elevationLossMeters'
  | 'minElevationMeters'
  | 'maxElevationMeters'
  | 'sampleCount'
>;

export type TrackChartPoint = {
  x: number;
  y: number;
  label?: string;
};

export type TrackChartSeries = {
  distanceElevation: TrackChartPoint[];
  distanceSpeed: TrackChartPoint[];
  timeSpeed: TrackChartPoint[];
  distanceGain: TrackChartPoint[];
  distanceAccuracy: TrackChartPoint[];
};

export type TrackInterval = {
  index: number;
  label: string;
  distanceMeters: number;
  elapsedSeconds: number;
  movingSeconds: number;
  averageSpeedMps: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
};

export type TrackRoutePreview = {
  id: string;
  title: string;
  coordinates: RouteCoordinate[];
  distanceMeters: number;
};
