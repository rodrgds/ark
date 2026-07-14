import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Track, TrackPoint } from '@/types/tracks';
import type { LocationObject } from 'expo-location';

const insertedPointIndexes: number[] = [];
let lastPoint: TrackPoint | null = null;
let trackStatus: Track['status'] = 'recording';

const track: Track = {
  id: 'track-1',
  title: 'Field test',
  description: null,
  activityType: 'walk',
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

mock.module('react-native', () => ({
  AppState: {
    currentState: 'background',
    addEventListener: () => ({ remove: () => undefined }),
  },
  Platform: { OS: 'web' },
}));

mock.module('expo-location', () => ({
  hasStartedLocationUpdatesAsync: async () => false,
  stopLocationUpdatesAsync: async () => undefined,
}));

mock.module('@/services/preferences/preferences.service', () => ({
  PreferencesService: {
    getFieldPreferences: async () => ({ recordingProfile: 'balanced' }),
  },
}));

mock.module('@/services/db/repositories/maps.repo', () => ({ MapsRepository: {} }));

mock.module('@/services/files/filesystem.service', () => ({ FileSystemService: {} }));

mock.module('@/services/db/repositories/tracks.repo', () => ({
  TracksRepository: {
    getActiveTrack: async () => ({ ...track, status: trackStatus }),
    getTrack: async () => ({ ...track, status: trackStatus }),
    getLastPoint: async () => lastPoint,
    insertPoints: async (_trackId: string, points: TrackPoint[]) => {
      await Promise.resolve();
      for (const point of points) insertedPointIndexes.push(point.pointIndex);
      lastPoint = points.at(-1) ?? lastPoint;
    },
    updateTrackStatus: async (_trackId: string, status: Track['status']) => {
      trackStatus = status;
    },
  },
}));

mock.module('@/services/tracks/track-statistics', () => ({
  buildTrackPointDraft: ({
    previousPoint,
    sample,
  }: {
    previousPoint: TrackPoint | null;
    sample: { recordedAt: number };
  }) => point((previousPoint?.pointIndex ?? -1) + 1, 'sample', sample.recordedAt),
  createControlPoint: ({
    previousPoint,
    kind,
  }: {
    previousPoint: TrackPoint | null;
    kind: TrackPoint['kind'];
  }) => point((previousPoint?.pointIndex ?? -1) + 1, kind, Date.now()),
}));

let TrackRecordingService: typeof import('./track-recording.service').TrackRecordingService;

beforeAll(async () => {
  ({ TrackRecordingService } = await import('./track-recording.service'));
});

beforeEach(() => {
  insertedPointIndexes.length = 0;
  lastPoint = point(0, 'start', 1_000);
  trackStatus = 'recording';
  TrackRecordingService.resetOperationQueueForTests();
});

describe('TrackRecordingService operation coordinator', () => {
  test('serializes foreground and background batches before allocating point indexes', async () => {
    await Promise.all([
      TrackRecordingService.handleLocationBatch([location(2_000)]),
      TrackRecordingService.handleLocationBatch([location(3_000)]),
    ]);

    expect(insertedPointIndexes).toEqual([1, 2]);
  });

  test('orders lifecycle changes after already queued location samples', async () => {
    await Promise.all([
      TrackRecordingService.handleLocationBatch([location(2_000)]),
      TrackRecordingService.pauseRecording(track.id),
    ]);

    expect(insertedPointIndexes).toEqual([1, 2]);
    expect(lastPoint?.kind).toBe('pause');
    expect(trackStatus).toBe('paused');
  });
});

function location(timestamp: number): LocationObject {
  return {
    timestamp,
    coords: {
      latitude: 38.72,
      longitude: -9.14,
      altitude: 10,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 1,
    },
  } as LocationObject;
}

function point(pointIndex: number, kind: TrackPoint['kind'], recordedAt: number): TrackPoint {
  return {
    id: `point-${pointIndex}`,
    trackId: track.id,
    segmentIndex: 0,
    pointIndex,
    kind,
    latitude: 38.72,
    longitude: -9.14,
    altitudeMeters: 10,
    altitudeSource: 'gps',
    pressureHpa: null,
    horizontalAccuracyMeters: 5,
    verticalAccuracyMeters: 5,
    speedMps: 1,
    bearingDegrees: 0,
    distanceFromPreviousMeters: 0,
    elapsedSeconds: 0,
    movingElapsedSeconds: 0,
    recordedAt,
    createdAt: recordedAt,
  };
}
