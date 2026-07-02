import { TRACK_RECORDING_PROFILES } from '@/constants/tracks';
import { getMapPinMeta } from '@/constants/map-pins';
import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { TracksRepository } from '@/services/db/repositories/tracks.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { TRACK_LOCATION_TASK } from '@/services/tracks/track-task.constants';
import {
  buildTrackPointDraft,
  createControlPoint,
  type TrackLocationSample,
} from '@/services/tracks/track-statistics';
import type {
  Track,
  TrackActivityType,
  TrackMarker,
  TrackMarkerType,
  TrackPoint,
  TrackRecordingProfile,
} from '@/types/tracks';
import type { LocationObject } from 'expo-location';
import { AppState, Platform } from 'react-native';

type LocationModule = typeof import('expo-location');

type RecordingSnapshot = {
  activeTrack: Track | null;
  lastPoint: TrackPoint | null;
  markers: TrackMarker[];
  backgroundPermissionGranted: boolean;
  foregroundPermissionGranted: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();
let foregroundLocationSubscription: { remove: () => void } | null = null;
let foregroundLocationTrackId: string | null = null;
let appStateSubscription: { remove: () => void } | null = null;

export class TrackRecordingService {
  static subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  static async getSnapshot(): Promise<RecordingSnapshot> {
    const [activeTrack, permissions] = await Promise.all([
      TracksRepository.getActiveTrack(),
      this.getPermissionStatus(),
    ]);
    const [lastPoint, markers] = activeTrack
      ? await Promise.all([
          TracksRepository.getLastPoint(activeTrack.id),
          TracksRepository.listMarkers(activeTrack.id),
        ])
      : [null, [] as TrackMarker[]];
    return {
      activeTrack,
      lastPoint,
      markers,
      ...permissions,
    };
  }

  static async startRecording(input: { activityType: TrackActivityType; title?: string }) {
    const permissions = await this.ensureForegroundPermission();
    if (!permissions.foregroundPermissionGranted) {
      throw new Error('Location permission is required before Ark can record a track.');
    }
    await this.ensureBackgroundPermission().catch(() => ({
      backgroundPermissionGranted: false,
      foregroundPermissionGranted: true,
    }));
    const now = Date.now();
    const track = await TracksRepository.createTrack({
      activityType: input.activityType,
      title: input.title ?? defaultRecordingTitle(input.activityType, now),
      startedAt: now,
    });
    const current = await this.getCurrentLocation().catch(() => null);
    const startPoint = createControlPoint({
      track,
      previousPoint: null,
      kind: 'start',
      recordedAt: current?.timestamp ?? now,
      latitude: current?.coords.latitude ?? null,
      longitude: current?.coords.longitude ?? null,
    });
    await TracksRepository.insertPoints(track.id, [startPoint]);
    await this.startLocationUpdates(track);
    emitChange();
    return track;
  }

  static async pauseRecording(trackId: string) {
    const track = await requireActiveTrack(trackId);
    const previousPoint = await TracksRepository.getLastPoint(track.id);
    await TracksRepository.insertPoints(track.id, [
      createControlPoint({ track, previousPoint, kind: 'pause' }),
    ]);
    await TracksRepository.updateTrackStatus(track.id, 'paused');
    await this.stopLocationUpdates();
    emitChange();
  }

  static async resumeRecording(trackId: string) {
    const track = await requireActiveTrack(trackId);
    const previousPoint = await TracksRepository.getLastPoint(track.id);
    await TracksRepository.updateTrackStatus(track.id, 'recording');
    await TracksRepository.insertPoints(track.id, [
      createControlPoint({ track, previousPoint, kind: 'resume' }),
    ]);
    await this.startLocationUpdates({ ...track, status: 'recording' });
    emitChange();
  }

  static async finishRecording(trackId: string) {
    const track = await requireActiveTrack(trackId);
    const previousPoint = await TracksRepository.getLastPoint(track.id);
    await TracksRepository.insertPoints(track.id, [
      createControlPoint({ track, previousPoint, kind: 'stop' }),
    ]);
    await TracksRepository.updateTrackStatus(track.id, 'finished', Date.now());
    await TracksRepository.recalculateTrackStats(track.id);
    await this.stopLocationUpdates();
    emitChange();
  }

  static async discardRecording(trackId: string) {
    await TracksRepository.softDeleteTrack(trackId);
    await this.stopLocationUpdates();
    emitChange();
  }

  static async recoverActiveRecording() {
    const active = await TracksRepository.getActiveTrack();
    this.bindForegroundAppState();
    if (active?.status === 'recording') {
      await this.startLocationUpdates(active).catch(async (error) => {
        await TracksRepository.recordTrackError(
          active.id,
          error instanceof Error ? error.message : 'Unable to resume background recording.'
        ).catch(() => undefined);
      });
    }
    emitChange();
  }

  static async syncForegroundLocationWatcher() {
    const active = await TracksRepository.getActiveTrack().catch(() => null);
    if (active?.status === 'recording') {
      await startForegroundLocationWatcher(active);
    } else {
      stopForegroundLocationWatcher();
    }
  }

  static async handleLocationBatch(locations: LocationObject[]) {
    if (!locations.length) return;
    const track = await TracksRepository.getActiveTrack();
    if (!track || track.status !== 'recording') return;
    const preferences = await PreferencesService.getFieldPreferences();
    const previous = await TracksRepository.getLastPoint(track.id);
    const drafts = createLocationPointDrafts({
      track,
      previousPoint: previous,
      locations,
      profile: preferences.recordingProfile,
    });
    if (!drafts.length) return;
    await TracksRepository.insertPoints(track.id, drafts);
    emitChange();
  }

  static async recordTaskError(message: string) {
    const active = await TracksRepository.getActiveTrack().catch(() => null);
    if (active) {
      await TracksRepository.recordTrackError(active.id, message).catch(() => undefined);
    }
    emitChange();
  }

  static async addMarker(input: {
    title: string;
    description?: string | null;
    markerType: TrackMarkerType;
    photoUri?: string | null;
    saveToMap?: boolean;
  }) {
    const track = await TracksRepository.getActiveTrack();
    if (!track) throw new Error('Start a track before adding markers.');
    const lastPoint = await TracksRepository.getLastPoint(track.id);
    if (lastPoint?.latitude == null || lastPoint.longitude == null) {
      throw new Error('Ark needs one GPS point before it can place this marker.');
    }
    const mapMarkerId = input.saveToMap
      ? await MapsRepository.createMarker({
          title: input.title.trim() || markerTypeLabel(input.markerType),
          description: input.description ?? null,
          pinType:
            input.markerType === 'water'
              ? 'water'
              : input.markerType === 'camp'
                ? 'shelter'
                : 'custom',
          latitude: lastPoint.latitude,
          longitude: lastPoint.longitude,
          photoUri: input.photoUri ?? null,
          color: getMapPinMeta('custom').color,
        })
      : null;
    const marker = await TracksRepository.createMarker({
      trackId: track.id,
      mapMarkerId,
      title: input.title.trim() || markerTypeLabel(input.markerType),
      description: input.description,
      markerType: input.markerType,
      latitude: lastPoint.latitude,
      longitude: lastPoint.longitude,
      altitudeMeters: lastPoint.altitudeMeters,
      elapsedSeconds: lastPoint.elapsedSeconds,
      distanceMeters: track.distanceMeters,
      recordedAt: lastPoint.recordedAt,
      photoUri: input.photoUri ?? null,
    });
    emitChange();
    return marker;
  }

  static async copyTrackPhoto(sourceUri: string) {
    return FileSystemService.copyToAppDirectory({
      sourceUri,
      directory: 'tracks',
      fileName: `track-photo-${Date.now()}.jpg`,
    });
  }

  static async getPermissionStatus() {
    const Location = await loadLocation();
    const [foreground, background] = await Promise.all([
      Location.getForegroundPermissionsAsync().catch(() => null),
      Location.getBackgroundPermissionsAsync().catch(() => null),
    ]);
    return {
      foregroundPermissionGranted: !!foreground?.granted,
      backgroundPermissionGranted: !!background?.granted,
    };
  }

  private static async ensureForegroundPermission() {
    const Location = await loadLocation();
    const existing = await Location.getForegroundPermissionsAsync();
    const permission = existing.granted
      ? existing
      : await Location.requestForegroundPermissionsAsync();
    return {
      foregroundPermissionGranted: permission.granted,
      backgroundPermissionGranted: false,
    };
  }

  private static async ensureBackgroundPermission() {
    const Location = await loadLocation();
    const existing = await Location.getBackgroundPermissionsAsync();
    const permission = existing.granted
      ? existing
      : await Location.requestBackgroundPermissionsAsync();
    return {
      foregroundPermissionGranted: true,
      backgroundPermissionGranted: permission.granted,
    };
  }

  private static async getCurrentLocation() {
    const Location = await loadLocation();
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  }

  private static async startLocationUpdates(track: Track) {
    const Location = await loadLocation();
    const preferences = await PreferencesService.getFieldPreferences();
    const profile = TRACK_RECORDING_PROFILES[preferences.recordingProfile];
    this.bindForegroundAppState();
    const started = await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK).catch(
      () => false
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK).catch(() => undefined);
    }
    await Location.startLocationUpdatesAsync(TRACK_LOCATION_TASK, {
      accuracy:
        preferences.recordingProfile === 'precision'
          ? Location.Accuracy.BestForNavigation
          : Location.Accuracy.High,
      distanceInterval: profile.distanceIntervalMeters,
      timeInterval: profile.timeIntervalMs,
      deferredUpdatesDistance: profile.deferredDistanceMeters,
      deferredUpdatesInterval: profile.deferredIntervalMs,
      activityType: activityTypeForLocation(Location, track.activityType),
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService:
        Platform.OS === 'android'
          ? {
              notificationTitle: 'Ark is recording a track',
              notificationBody: `${track.title} is active.`,
              notificationColor: '#95A78B',
              killServiceOnDestroy: false,
            }
          : undefined,
    });
    await startForegroundLocationWatcher(track);
  }

  private static async stopLocationUpdates() {
    const Location = await loadLocation();
    stopForegroundLocationWatcher();
    const started = await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK).catch(
      () => false
    );
    if (started) await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK);
  }

  private static bindForegroundAppState() {
    if (appStateSubscription) return;
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void TrackRecordingService.syncForegroundLocationWatcher().catch((error) => {
          void TrackRecordingService.recordTaskError(
            error instanceof Error ? error.message : 'Unable to resume foreground track recording.'
          );
        });
      } else {
        stopForegroundLocationWatcher();
      }
    });
  }
}

async function startForegroundLocationWatcher(track: Track) {
  if (Platform.OS === 'web' || AppState.currentState !== 'active') return;
  if (foregroundLocationSubscription && foregroundLocationTrackId === track.id) return;

  stopForegroundLocationWatcher();

  const Location = await loadLocation();
  const preferences = await PreferencesService.getFieldPreferences();
  const profile = TRACK_RECORDING_PROFILES[preferences.recordingProfile];
  foregroundLocationTrackId = track.id;
  foregroundLocationSubscription = await Location.watchPositionAsync(
    {
      accuracy:
        preferences.recordingProfile === 'precision'
          ? Location.Accuracy.BestForNavigation
          : Location.Accuracy.High,
      distanceInterval: Math.max(1, Math.min(profile.distanceIntervalMeters, 5)),
      timeInterval: Math.min(profile.timeIntervalMs, 2_000),
    },
    (location) => {
      void TrackRecordingService.handleLocationBatch([location]).catch((error) =>
        TrackRecordingService.recordTaskError(
          error instanceof Error ? error.message : 'Foreground track recording failed.'
        )
      );
    }
  );
}

function stopForegroundLocationWatcher() {
  foregroundLocationSubscription?.remove();
  foregroundLocationSubscription = null;
  foregroundLocationTrackId = null;
}

function createLocationPointDrafts(input: {
  track: Track;
  previousPoint: TrackPoint | null;
  locations: LocationObject[];
  profile: TrackRecordingProfile;
}) {
  const drafts = [];
  let previous = input.previousPoint;
  for (const location of input.locations.sort((a, b) => a.timestamp - b.timestamp)) {
    const sample: TrackLocationSample = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitudeMeters: location.coords.altitude,
      horizontalAccuracyMeters: location.coords.accuracy,
      verticalAccuracyMeters: location.coords.altitudeAccuracy,
      speedMps: location.coords.speed,
      bearingDegrees: location.coords.heading,
      recordedAt: location.timestamp,
    };
    const draft = buildTrackPointDraft({
      track: input.track,
      sample,
      previousPoint: previous,
      profile: input.profile,
    });
    if (!draft) continue;
    drafts.push(draft);
    previous = { ...draft, id: draft.id ?? 'pending', createdAt: draft.createdAt ?? Date.now() };
  }
  return drafts;
}

async function requireActiveTrack(trackId: string) {
  const track = await TracksRepository.getTrack(trackId);
  if (!track || track.deletedAt || track.status === 'finished' || track.status === 'discarded') {
    throw new Error('Track recording is not active.');
  }
  return track;
}

async function loadLocation(): Promise<LocationModule> {
  return import('expo-location');
}

function activityTypeForLocation(Location: LocationModule, activityType: TrackActivityType) {
  if (activityType === 'drive') return Location.ActivityType.AutomotiveNavigation;
  if (activityType === 'paddle') return Location.ActivityType.OtherNavigation;
  if (
    activityType === 'walk' ||
    activityType === 'hike' ||
    activityType === 'run' ||
    activityType === 'cycle'
  ) {
    return Location.ActivityType.Fitness;
  }
  return Location.ActivityType.Other;
}

function emitChange() {
  for (const listener of listeners) listener();
}

function defaultRecordingTitle(activityType: TrackActivityType, timestamp: number) {
  const label = activityType.charAt(0).toUpperCase() + activityType.slice(1);
  return `${label} ${new Date(timestamp).toLocaleString()}`;
}

function markerTypeLabel(markerType: TrackMarkerType) {
  return markerType.charAt(0).toUpperCase() + markerType.slice(1);
}
