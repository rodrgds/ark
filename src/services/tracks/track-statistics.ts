import { TRACK_RECORDING_PROFILES } from '@/constants/tracks';
import { haversineMeters } from '@/lib/geo';
import type {
  Track,
  TrackChartPoint,
  TrackChartSeries,
  TrackInterval,
  TrackPoint,
  TrackPointDraft,
  TrackRecordingProfile,
  TrackStats,
} from '@/types/tracks';

const MIN_ELEVATION_DELTA_METERS = 3;
const MIN_MOVING_SPEED_MPS = 0.45;
const MAX_REASONABLE_SPEED_MPS = 75;
const MAX_CHART_POINTS = 180;

export type TrackLocationSample = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number | null;
  horizontalAccuracyMeters?: number | null;
  verticalAccuracyMeters?: number | null;
  speedMps?: number | null;
  bearingDegrees?: number | null;
  recordedAt: number;
};

export function isUsableLocationSample(
  sample: TrackLocationSample,
  profile: TrackRecordingProfile
) {
  if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) return false;
  const accuracy = sample.horizontalAccuracyMeters;
  if (
    accuracy != null &&
    accuracy > TRACK_RECORDING_PROFILES[profile].maxHorizontalAccuracyMeters
  ) {
    return false;
  }
  const speed = sample.speedMps;
  if (speed != null && speed > MAX_REASONABLE_SPEED_MPS) return false;
  return true;
}

export function buildTrackPointDraft(input: {
  track: Track;
  sample: TrackLocationSample;
  previousPoint: TrackPoint | null;
  profile: TrackRecordingProfile;
  pressureHpa?: number | null;
}): TrackPointDraft | null {
  if (!isUsableLocationSample(input.sample, input.profile)) return null;
  const previous = input.previousPoint;
  const segmentIndex = previous?.segmentIndex ?? 0;
  const pointIndex = (previous?.pointIndex ?? -1) + 1;
  const distanceFromPreviousMeters =
    previous?.latitude != null && previous.longitude != null
      ? haversineMeters(
          previous.latitude,
          previous.longitude,
          input.sample.latitude,
          input.sample.longitude
        )
      : 0;
  const elapsedSeconds = Math.max(0, (input.sample.recordedAt - input.track.startedAt) / 1000);
  const previousMovingSeconds = previous?.movingElapsedSeconds ?? 0;
  const deltaSeconds =
    previous && input.sample.recordedAt > previous.recordedAt
      ? (input.sample.recordedAt - previous.recordedAt) / 1000
      : 0;
  const movedEnough =
    distanceFromPreviousMeters >= TRACK_RECORDING_PROFILES[input.profile].distanceIntervalMeters;
  const speedImpliesMoving = (input.sample.speedMps ?? 0) >= MIN_MOVING_SPEED_MPS;
  const movingDeltaSeconds =
    previous &&
    previous.kind !== 'pause' &&
    previous.kind !== 'stop' &&
    (movedEnough || speedImpliesMoving)
      ? deltaSeconds
      : 0;

  if (
    previous &&
    !movedEnough &&
    deltaSeconds < TRACK_RECORDING_PROFILES[input.profile].timeIntervalMs / 1000
  ) {
    return null;
  }

  const gapDistance =
    distanceFromPreviousMeters > TRACK_RECORDING_PROFILES[input.profile].maxGapMeters;
  const gapTime = deltaSeconds > TRACK_RECORDING_PROFILES[input.profile].idleAfterSeconds;
  const kind = gapDistance || gapTime ? 'idle' : 'sample';

  return {
    trackId: input.track.id,
    segmentIndex: gapDistance || gapTime ? segmentIndex + 1 : segmentIndex,
    pointIndex,
    kind,
    latitude: input.sample.latitude,
    longitude: input.sample.longitude,
    altitudeMeters: input.sample.altitudeMeters ?? null,
    altitudeSource: input.sample.altitudeMeters == null ? 'unknown' : 'gps',
    pressureHpa: input.pressureHpa ?? null,
    horizontalAccuracyMeters: input.sample.horizontalAccuracyMeters ?? null,
    verticalAccuracyMeters: input.sample.verticalAccuracyMeters ?? null,
    speedMps: input.sample.speedMps ?? null,
    bearingDegrees: input.sample.bearingDegrees ?? null,
    distanceFromPreviousMeters: kind === 'idle' ? 0 : distanceFromPreviousMeters,
    elapsedSeconds,
    movingElapsedSeconds: previousMovingSeconds + movingDeltaSeconds,
    recordedAt: input.sample.recordedAt,
  };
}

export function createControlPoint(input: {
  track: Track;
  previousPoint: TrackPoint | null;
  kind: 'start' | 'pause' | 'resume' | 'stop';
  recordedAt?: number;
  latitude?: number | null;
  longitude?: number | null;
}): TrackPointDraft {
  const now = input.recordedAt ?? Date.now();
  const previous = input.previousPoint;
  const segmentBump = input.kind === 'resume' ? 1 : 0;
  return {
    trackId: input.track.id,
    segmentIndex: (previous?.segmentIndex ?? 0) + segmentBump,
    pointIndex: (previous?.pointIndex ?? -1) + 1,
    kind: input.kind,
    latitude: input.latitude ?? previous?.latitude ?? null,
    longitude: input.longitude ?? previous?.longitude ?? null,
    altitudeMeters: null,
    altitudeSource: 'unknown',
    pressureHpa: null,
    horizontalAccuracyMeters: null,
    verticalAccuracyMeters: null,
    speedMps: null,
    bearingDegrees: null,
    distanceFromPreviousMeters: 0,
    elapsedSeconds: Math.max(0, (now - input.track.startedAt) / 1000),
    movingElapsedSeconds: previous?.movingElapsedSeconds ?? 0,
    recordedAt: now,
  };
}

export function computeTrackStats(
  points: TrackPoint[],
  track?: Pick<Track, 'startedAt' | 'endedAt'>
): TrackStats {
  const ordered = [...points].sort((a, b) => a.pointIndex - b.pointIndex);
  const samplePoints = ordered.filter((point) => point.kind === 'sample' || point.kind === 'idle');
  let distanceMeters = 0;
  let movingTimeSeconds = 0;
  let maxSpeedMps: number | null = null;
  let elevationGainMeters = 0;
  let elevationLossMeters = 0;
  let minElevationMeters: number | null = null;
  let maxElevationMeters: number | null = null;
  let previousSample: TrackPoint | null = null;
  let lastElevation: number | null = null;

  for (const point of ordered) {
    if (point.kind === 'pause' || point.kind === 'stop') {
      previousSample = null;
      continue;
    }
    if (
      point.kind !== 'sample' &&
      point.kind !== 'idle' &&
      point.kind !== 'resume' &&
      point.kind !== 'start'
    ) {
      continue;
    }

    if (point.kind === 'sample' || point.kind === 'idle') {
      distanceMeters += Math.max(0, point.distanceFromPreviousMeters);
    }

    if (previousSample && point.recordedAt > previousSample.recordedAt && point.kind !== 'idle') {
      const deltaSeconds = (point.recordedAt - previousSample.recordedAt) / 1000;
      const speed = point.speedMps ?? point.distanceFromPreviousMeters / Math.max(deltaSeconds, 1);
      if (point.distanceFromPreviousMeters > 2 || speed >= MIN_MOVING_SPEED_MPS) {
        movingTimeSeconds += deltaSeconds;
      }
    }

    if (point.speedMps != null) {
      maxSpeedMps = maxSpeedMps == null ? point.speedMps : Math.max(maxSpeedMps, point.speedMps);
    }

    if (point.altitudeMeters != null) {
      minElevationMeters =
        minElevationMeters == null
          ? point.altitudeMeters
          : Math.min(minElevationMeters, point.altitudeMeters);
      maxElevationMeters =
        maxElevationMeters == null
          ? point.altitudeMeters
          : Math.max(maxElevationMeters, point.altitudeMeters);
      if (lastElevation != null) {
        const delta = point.altitudeMeters - lastElevation;
        if (Math.abs(delta) >= MIN_ELEVATION_DELTA_METERS) {
          if (delta > 0) elevationGainMeters += delta;
          else elevationLossMeters += Math.abs(delta);
          lastElevation = point.altitudeMeters;
        }
      } else {
        lastElevation = point.altitudeMeters;
      }
    }

    if (point.kind === 'sample' || point.kind === 'idle') previousSample = point;
  }

  const firstTime = track?.startedAt ?? ordered[0]?.recordedAt ?? Date.now();
  const lastTime = track?.endedAt ?? ordered.at(-1)?.recordedAt ?? firstTime;
  const totalTimeSeconds = Math.max(0, (lastTime - firstTime) / 1000);
  const averageSpeedMps = totalTimeSeconds > 0 ? distanceMeters / totalTimeSeconds : null;
  const averageMovingSpeedMps = movingTimeSeconds > 0 ? distanceMeters / movingTimeSeconds : null;

  return {
    distanceMeters,
    totalTimeSeconds,
    movingTimeSeconds,
    averageSpeedMps,
    averageMovingSpeedMps,
    maxSpeedMps,
    elevationGainMeters,
    elevationLossMeters,
    minElevationMeters,
    maxElevationMeters,
    sampleCount: samplePoints.length,
  };
}

export function buildChartSeries(points: TrackPoint[]): TrackChartSeries {
  const ordered = [...points].sort((a, b) => a.pointIndex - b.pointIndex);
  const distanceElevation: TrackChartPoint[] = [];
  const distanceSpeed: TrackChartPoint[] = [];
  const timeSpeed: TrackChartPoint[] = [];
  const distanceGain: TrackChartPoint[] = [];
  const distanceAccuracy: TrackChartPoint[] = [];
  let distance = 0;
  let gain = 0;
  let lastElevation: number | null = null;

  for (const point of ordered) {
    if (point.kind !== 'sample' && point.kind !== 'idle') continue;
    distance += Math.max(0, point.distanceFromPreviousMeters);
    if (point.altitudeMeters != null) {
      if (
        lastElevation != null &&
        point.altitudeMeters - lastElevation >= MIN_ELEVATION_DELTA_METERS
      ) {
        gain += point.altitudeMeters - lastElevation;
      }
      lastElevation = point.altitudeMeters;
      distanceElevation.push({ x: distance, y: point.altitudeMeters });
      distanceGain.push({ x: distance, y: gain });
    }
    if (point.speedMps != null) {
      distanceSpeed.push({ x: distance, y: point.speedMps });
      timeSpeed.push({ x: point.elapsedSeconds, y: point.speedMps });
    }
    if (point.horizontalAccuracyMeters != null) {
      distanceAccuracy.push({ x: distance, y: point.horizontalAccuracyMeters });
    }
  }

  return {
    distanceElevation: downsampleSeries(distanceElevation),
    distanceSpeed: downsampleSeries(distanceSpeed),
    timeSpeed: downsampleSeries(timeSpeed),
    distanceGain: downsampleSeries(distanceGain),
    distanceAccuracy: downsampleSeries(distanceAccuracy),
  };
}

export function buildDistanceIntervals(
  points: TrackPoint[],
  intervalMeters: number
): TrackInterval[] {
  return buildIntervals(points, {
    kind: 'distance',
    interval: intervalMeters,
    label: (index) => `${index + 1}`,
  });
}

export function buildTimeIntervals(points: TrackPoint[], intervalSeconds: number): TrackInterval[] {
  return buildIntervals(points, {
    kind: 'time',
    interval: intervalSeconds,
    label: (index) => `${index + 1}`,
  });
}

function buildIntervals(
  points: TrackPoint[],
  input: {
    kind: 'distance' | 'time';
    interval: number;
    label: (index: number) => string;
  }
) {
  const ordered = [...points]
    .filter((point) => point.kind === 'sample' || point.kind === 'idle')
    .sort((a, b) => a.pointIndex - b.pointIndex);
  const intervals: TrackInterval[] = [];
  let current = emptyInterval(0, input.label(0));
  let bucketLimit = input.interval;
  let cumulativeDistance = 0;
  let previousMoving = 0;
  let previousElapsed = 0;

  for (const point of ordered) {
    cumulativeDistance += Math.max(0, point.distanceFromPreviousMeters);
    const key = input.kind === 'distance' ? cumulativeDistance : point.elapsedSeconds;
    while (key > bucketLimit && (current.distanceMeters > 0 || current.elapsedSeconds > 0)) {
      finalizeInterval(current);
      intervals.push(current);
      current = emptyInterval(intervals.length, input.label(intervals.length));
      bucketLimit += input.interval;
    }
    current.distanceMeters =
      cumulativeDistance - intervals.reduce((sum, item) => sum + item.distanceMeters, 0);
    current.elapsedSeconds = Math.max(0, point.elapsedSeconds - previousElapsed);
    current.movingSeconds = Math.max(0, point.movingElapsedSeconds - previousMoving);
    if (point.altitudeMeters != null) {
      current.elevationGainMeters = Math.max(current.elevationGainMeters, 0);
    }
    previousElapsed = intervals.reduce((sum, item) => sum + item.elapsedSeconds, 0);
    previousMoving = intervals.reduce((sum, item) => sum + item.movingSeconds, 0);
  }

  if (current.distanceMeters > 0 || current.elapsedSeconds > 0) {
    finalizeInterval(current);
    intervals.push(current);
  }

  return intervals;
}

function emptyInterval(index: number, label: string): TrackInterval {
  return {
    index,
    label,
    distanceMeters: 0,
    elapsedSeconds: 0,
    movingSeconds: 0,
    averageSpeedMps: null,
    elevationGainMeters: 0,
    elevationLossMeters: 0,
  };
}

function finalizeInterval(interval: TrackInterval) {
  interval.averageSpeedMps =
    interval.movingSeconds > 0 ? interval.distanceMeters / interval.movingSeconds : null;
}

export function downsampleSeries<T extends TrackChartPoint>(
  series: T[],
  maxPoints = MAX_CHART_POINTS
): T[] {
  if (series.length <= maxPoints) return series;
  const stride = Math.ceil(series.length / maxPoints);
  const result = series.filter((_, index) => index % stride === 0);
  const last = series.at(-1);
  if (last && result.at(-1) !== last) result.push(last);
  return result;
}

export function routeCoordinates(points: TrackPoint[]) {
  return points
    .filter((point) => point.latitude != null && point.longitude != null)
    .sort((a, b) => a.pointIndex - b.pointIndex)
    .map((point) => ({ latitude: point.latitude!, longitude: point.longitude! }));
}
