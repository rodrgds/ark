import { describe, expect, test } from 'bun:test';
import {
  buildChartSeries,
  buildDistanceIntervals,
  buildTrackPointDraft,
  computeTrackStats,
  isUsableLocationSample,
} from '@/services/tracks/track-statistics';
import type { Track, TrackPoint } from '@/types/tracks';

const track: Track = {
  id: 'track-1',
  title: 'Test track',
  description: null,
  activityType: 'hike',
  status: 'recording',
  startedAt: 1_000,
  endedAt: null,
  timezoneOffsetMinutes: 0,
  distanceMeters: 0,
  totalTimeSeconds: 0,
  movingTimeSeconds: 0,
  averageSpeedMps: null,
  averageMovingSpeedMps: null,
  maxSpeedMps: null,
  elevationGainMeters: 0,
  elevationLossMeters: 0,
  minElevationMeters: null,
  maxElevationMeters: null,
  sampleCount: 0,
  markerCount: 0,
  recordingGapCount: 0,
  lastError: null,
  createdAt: 1_000,
  updatedAt: 1_000,
  deletedAt: null,
};

describe('track statistics', () => {
  test('filters poor samples and builds persisted point drafts', () => {
    expect(
      isUsableLocationSample(
        {
          latitude: 38,
          longitude: -9,
          horizontalAccuracyMeters: 250,
          speedMps: 1,
          recordedAt: 1_000,
        },
        'normal'
      )
    ).toBe(false);

    const draft = buildTrackPointDraft({
      track,
      previousPoint: null,
      profile: 'normal',
      sample: {
        latitude: 38,
        longitude: -9,
        altitudeMeters: 100,
        horizontalAccuracyMeters: 8,
        speedMps: 1.2,
        recordedAt: 6_000,
      },
    });

    expect(draft).toMatchObject({
      kind: 'sample',
      latitude: 38,
      longitude: -9,
      altitudeSource: 'gps',
      elapsedSeconds: 5,
    });
  });

  test('computes distance, moving time, speed, and elevation gain', () => {
    const points = samplePoints();
    const stats = computeTrackStats(points, { startedAt: 1_000, endedAt: 181_000 });
    expect(stats.distanceMeters).toBe(220);
    expect(stats.movingTimeSeconds).toBe(180);
    expect(stats.averageMovingSpeedMps).toBeCloseTo(1.222, 2);
    expect(stats.maxSpeedMps).toBe(1.8);
    expect(stats.elevationGainMeters).toBe(16);
    expect(stats.elevationLossMeters).toBe(5);
    expect(stats.sampleCount).toBe(4);
  });

  test('builds chart series and distance intervals from raw samples', () => {
    const points = samplePoints();
    const charts = buildChartSeries(points);
    expect(charts.distanceElevation).toHaveLength(4);
    expect(charts.distanceSpeed).toHaveLength(4);
    expect(charts.distanceGain.at(-1)?.y).toBe(16);

    const intervals = buildDistanceIntervals(points, 100);
    expect(intervals.length).toBeGreaterThanOrEqual(2);
    expect(intervals[0]?.distanceMeters).toBeGreaterThan(0);
    expect(intervals[0]?.averageSpeedMps).not.toBeNull();
  });
});

function samplePoints(): TrackPoint[] {
  return [
    point({ index: 0, distance: 0, elapsed: 0, moving: 0, altitude: 100, speed: 1 }),
    point({ index: 1, distance: 110, elapsed: 90, moving: 90, altitude: 112, speed: 1.4 }),
    point({ index: 2, distance: 70, elapsed: 140, moving: 140, altitude: 107, speed: 1.8 }),
    point({ index: 3, distance: 40, elapsed: 180, moving: 180, altitude: 111, speed: 1.2 }),
  ];
}

function point(input: {
  index: number;
  distance: number;
  elapsed: number;
  moving: number;
  altitude: number;
  speed: number;
}): TrackPoint {
  return {
    id: `point-${input.index}`,
    trackId: 'track-1',
    segmentIndex: 0,
    pointIndex: input.index,
    kind: 'sample',
    latitude: 38 + input.index * 0.001,
    longitude: -9,
    altitudeMeters: input.altitude,
    altitudeSource: 'gps',
    pressureHpa: null,
    horizontalAccuracyMeters: 8,
    verticalAccuracyMeters: 5,
    speedMps: input.speed,
    bearingDegrees: 0,
    distanceFromPreviousMeters: input.distance,
    elapsedSeconds: input.elapsed,
    movingElapsedSeconds: input.moving,
    recordedAt: 1_000 + input.elapsed * 1000,
    createdAt: 1_000 + input.elapsed * 1000,
  };
}
