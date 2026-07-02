import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { TracksRepository } from '@/services/db/repositories/tracks.repo';
import { RagCleanupService } from '@/services/ai/rag-cleanup.service';
import { DownloadNotificationService } from '@/services/files/download-notifications.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { MapService, type MapLibreModule } from '@/services/maps/map.service';
import { sizeFromPackStatus } from '@/services/maps/map-pack-status';
import { getUnsupportedMapPackReason } from '@/services/maps/map-pack-format';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { OfflinePlaceIndexService } from '@/services/maps/offline-place-index.service';
import { getDownloadedRegionForCoordinate } from '@/services/maps/map-region-utils';
import { estimatedMapRegionBytes } from '@/services/maps/map-storage';
import { OfflineRoutingService } from '@/services/maps/offline-routing.service';
import type { MapPinType } from '@/constants/map-pins';
import type {
  MapMarker,
  MapRegion,
  OfflineMapSearchResult,
  RouteCoordinate,
  RoutingPreferences,
  RoutingProfile,
  SavedRoutePoint,
} from '@/types/maps';
import { haversineMeters, toRadians, formatPoint } from '@/lib/geo';
import { formatDistance } from '@/services/tracks/track-format';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { logger } from '@/lib/logger';

type OfflinePackStatusLike = {
  state: string;
  percentage: number;
  completedResourceCount: number;
  completedResourceSize?: number;
  completedTileCount?: number;
  completedTileSize?: number;
  requiredResourceCount: number;
};

const DOWNLOAD_STALL_TIMEOUT_MS = 30_000;
const MAX_STALL_RESTARTS = 1;

export class OfflineMapService {
  private static activeRegionId: string | null = null;
  private static startingQueuedRegion = false;
  private static lifecycleSubscription: { remove: () => void } | null = null;
  private static downloadWatchdogs = new Map<
    string,
    {
      packId: string;
      progress: number;
      restarts: number;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  static async createRegionDownload(input: {
    name: string;
    bounds?: { north: number; south: number; east: number; west: number };
    minZoom?: number;
    maxZoom?: number;
    estimatedSizeMb?: number | null;
    manifestRegionId?: string | null;
    manifestVersion?: number | null;
    styleUrl?: string;
    tileUrlTemplate?: string | null;
    packFormat?: MapRegion['packFormat'];
    packUrl?: string | null;
    dataVersion?: string | null;
    checksumSha256?: string | null;
    checksumSha256Url?: string | null;
    regionUpdatedAt?: string | null;
    routingPackUrl?: string | null;
    routingDataVersion?: string | null;
    routingChecksumSha256?: string | null;
  }) {
    return MapsRepository.createRegion({
      name: input.name,
      manifestRegionId: input.manifestRegionId,
      manifestVersion: input.manifestVersion,
      north: input.bounds?.north,
      south: input.bounds?.south,
      east: input.bounds?.east,
      west: input.bounds?.west,
      minZoom: input.minZoom,
      maxZoom: input.maxZoom,
      estimatedSizeMb: input.estimatedSizeMb,
      styleUrl: input.styleUrl,
      tileUrlTemplate: input.tileUrlTemplate,
      packFormat: input.packFormat,
      packUrl: input.packUrl,
      dataVersion: input.dataVersion,
      checksumSha256: input.checksumSha256,
      checksumSha256Url: input.checksumSha256Url,
      regionUpdatedAt: input.regionUpdatedAt,
      routingPackUrl: input.routingPackUrl,
      routingDataVersion: input.routingDataVersion,
      routingChecksumSha256: input.routingChecksumSha256,
    });
  }

  static listRegions() {
    return MapsRepository.listRegions();
  }

  static async getDownloadedRegionForCoordinate(latitude: number, longitude: number) {
    const regions = await MapsRepository.listRegions();
    return getDownloadedRegionForCoordinate(latitude, longitude, regions) ?? null;
  }

  static async syncNativePacks() {
    const maplibre = await MapService.loadMapLibre();
    if (!maplibre) return;

    const [regions, packs] = await Promise.all([
      MapsRepository.listRegions(),
      maplibre.OfflineManager.getPacks(),
    ]);

    for (const region of regions) {
      const pack = packs.find((candidate) => isPackForRegion(candidate, region));
      if (!pack) {
        if (region.status === 'downloaded' || region.status === 'downloading') {
          await MapsRepository.updateRegionStatus(region.id, {
            status: 'failed',
            progress: 0,
            sizeBytes: null,
            offlinePackId: null,
          });
        }
        continue;
      }
      const status = await pack.status().catch(() => null);
      if (!status) {
        await MapsRepository.updateRegionStatus(region.id, {
          status: 'failed',
          progress: 0,
          sizeBytes: null,
        });
        continue;
      }

      const isComplete = isOfflinePackComplete(status);

      // If the region was paused by the user, keep it paused and don't auto-resume.
      const isPaused = region.status === 'paused';
      const isQueuedBehindAnotherDownload =
        !isComplete &&
        !isPaused &&
        this.activeRegionId !== null &&
        this.activeRegionId !== region.id;
      const nextStatus = isComplete
        ? 'downloaded'
        : isPaused
          ? 'paused'
          : isQueuedBehindAnotherDownload
            ? 'queued'
            : 'downloading';

      await MapsRepository.updateRegionStatus(region.id, {
        status: nextStatus,
        progress: progressFromPackStatus(status),
        sizeBytes: sizeFromPackStatus(status),
        offlinePackId: pack.id,
      });

      if (isComplete) {
        this.completeRegionDownload(region.id);
        continue;
      }

      // Resume any pack that isn't complete so downloads continue after an app restart.
      // MapLibre pauses packs when the app is killed; .resume() restarts them.
      if (!isPaused && !isQueuedBehindAnotherDownload && this.activeRegionId == null) {
        this.activeRegionId = region.id;
      }
      if (isQueuedBehindAnotherDownload) {
        await pack.pause().catch(() => undefined);
        continue;
      }
      if (!isComplete && !isPaused) {
        await this.attachPackListeners(maplibre, region.id, pack.id);
        this.scheduleDownloadWatchdog(region.id, pack.id, progressFromPackStatus(status));
      }
      if (!isComplete && status.state === 'inactive' && !isPaused) {
        await pack.resume().catch(() => undefined);
      }
    }
    this.startNextQueuedRegion();
  }

  static bindLifecycle() {
    if (this.lifecycleSubscription) return () => undefined;
    void import('react-native')
      .then(({ AppState }) => {
        if (this.lifecycleSubscription) return;
        this.lifecycleSubscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void this.syncNativePacks().catch(() => undefined);
          }
        });
      })
      .catch(() => undefined);
    return () => {
      this.lifecycleSubscription?.remove();
      this.lifecycleSubscription = null;
    };
  }

  static async deleteRegion(id: string) {
    const region = await MapsRepository.getRegion(id);
    if (!region) return;

    const maplibre = await MapService.loadMapLibre();
    if (maplibre) {
      try {
        const packs = await maplibre.OfflineManager.getPacks();
        const pack = packs.find((candidate) => isPackForRegion(candidate, region));
        if (pack) {
          await maplibre.OfflineManager.deletePack(pack.id);
        }
      } catch (error) {
        logger.warn(error instanceof Error ? error.message : 'Unable to delete native map pack.');
      }
    }

    if (this.activeRegionId === id) this.completeRegionDownload(id);
    this.clearDownloadWatchdog(id);
    if (region.routingGraphUri) {
      await FileSystemService.deleteByUri(region.routingGraphUri).catch(() => undefined);
    }
    await RagCleanupService.removeSource(`map-region:${id}`);
    return MapsRepository.deleteRegion(id);
  }

  static async pauseRegion(id: string) {
    const region = await MapsRepository.getRegion(id);
    if (!region) return { ok: false, reason: 'Map region not found.' };

    const maplibre = await MapService.loadMapLibre();
    if (maplibre) {
      try {
        const packs = await maplibre.OfflineManager.getPacks();
        const pack = packs.find((candidate) => isPackForRegion(candidate, region));
        if (pack) {
          await pack.pause();
        }
      } catch (error) {
        logger.warn(error instanceof Error ? error.message : 'Unable to pause native map pack.');
      }
    }

    await MapsRepository.updateRegionStatus(id, { status: 'paused' });
    this.notifyRegionDownload(id, 'paused', region.progress);
    if (this.activeRegionId === id) this.completeRegionDownload(id);
    this.clearDownloadWatchdog(id);
    return { ok: true };
  }

  static async refreshRegion(id: string) {
    let region = await MapsRepository.getRegion(id);
    if (!region) return { ok: false, reason: 'Map region not found.' };
    if (
      region.north == null ||
      region.south == null ||
      region.east == null ||
      region.west == null
    ) {
      return { ok: false, reason: 'Region bounds are incomplete.' };
    }

    const catalogRegion = MapPresetsService.findPresetForRegion(region);
    const updateState = MapPresetsService.getRegionUpdateState(region);
    if (catalogRegion && updateState.available) {
      await MapsRepository.updateRegionManifest(id, {
        name: catalogRegion.name,
        manifestRegionId: catalogRegion.id,
        manifestVersion: MapPresetsService.getCatalogMeta().version,
        north: catalogRegion.bounds.north,
        south: catalogRegion.bounds.south,
        east: catalogRegion.bounds.east,
        west: catalogRegion.bounds.west,
        minZoom: catalogRegion.minZoom,
        maxZoom: catalogRegion.maxZoom,
        estimatedSizeMb: catalogRegion.estimatedSizeMb,
        styleUrl: catalogRegion.styleUrl ?? region.styleUrl ?? MapService.getDefaultStyleUrl(),
        tileUrlTemplate: catalogRegion.tileUrlTemplate,
        packFormat: catalogRegion.packFormat,
        packUrl: catalogRegion.packUrl,
        dataVersion: catalogRegion.dataVersion,
        checksumSha256: catalogRegion.checksumSha256,
        checksumSha256Url: catalogRegion.checksumSha256Url,
        regionUpdatedAt: catalogRegion.updatedAt,
        routingPackUrl: catalogRegion.routingPackUrl,
        routingDataVersion: catalogRegion.routingDataVersion,
        routingChecksumSha256: catalogRegion.routingChecksumSha256,
      });
      region = (await MapsRepository.getRegion(id)) ?? region;
    }
    const unsupportedPackReason = getUnsupportedMapPackReason(region);
    if (unsupportedPackReason) {
      await MapsRepository.updateRegionStatus(id, {
        status: 'failed',
        progress: 0,
        offlinePackId: null,
      });
      return { ok: false, reason: unsupportedPackReason };
    }
    try {
      await FileSystemService.ensureSpaceForDownload(
        estimatedMapRegionBytes({
          estimatedSizeMb: region.estimatedSizeMb ?? catalogRegion?.estimatedSizeMb,
        })
      );
    } catch (error) {
      await MapsRepository.updateRegionStatus(id, { status: 'failed', progress: 0 });
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Not enough free storage for this map.',
      };
    }
    if (
      region.north == null ||
      region.south == null ||
      region.east == null ||
      region.west == null
    ) {
      return { ok: false, reason: 'Region bounds are incomplete.' };
    }
    const offlineBounds = [region.west, region.south, region.east, region.north] satisfies [
      number,
      number,
      number,
      number,
    ];

    const maplibre = await MapService.loadMapLibre();
    if (!maplibre) {
      await MapsRepository.updateRegionStatus(id, { status: 'failed', progress: 0 });
      return { ok: false, reason: 'MapLibre native module is unavailable in this build.' };
    }

    const styleUrl = region.styleUrl ?? MapService.getDefaultStyleUrl();
    const styleReachable = await MapService.canReachStyleUrl(styleUrl);
    if (!styleReachable) {
      await MapsRepository.updateRegionStatus(id, { status: 'failed', progress: 0 });
      return {
        ok: false,
        reason:
          'Map tile source is unreachable. Connect to the internet, then retry the offline download.',
      };
    }

    if (this.activeRegionId && this.activeRegionId !== id) {
      await MapsRepository.updateRegionStatus(id, { status: 'queued', progress: region.progress });
      return { ok: true };
    }

    this.activeRegionId = id;
    await MapsRepository.updateRegionStatus(id, { status: 'downloading', progress: 0 });
    this.notifyRegionDownload(id, 'downloading', 0);
    try {
      maplibre.OfflineManager.setTileCountLimit?.(250000);
      const existingPacks = await maplibre.OfflineManager.getPacks();
      const existingPack = existingPacks.find((candidate) => isPackForRegion(candidate, region));
      if (existingPack && updateState.available) {
        await maplibre.OfflineManager.deletePack(existingPack.id).catch(() => undefined);
      } else if (existingPack) {
        const existingStatus = await existingPack.status().catch(() => null);
        if (existingStatus && isOfflinePackComplete(existingStatus)) {
          await MapsRepository.updateRegionStatus(id, {
            status: 'downloaded',
            progress: 1,
            sizeBytes: sizeFromPackStatus(existingStatus),
            offlinePackId: existingPack.id,
          });
          this.notifyRegionDownload(id, 'completed', 1);
          this.completeRegionDownload(id);
          return { ok: true };
        }
        await this.attachPackListeners(maplibre, id, existingPack.id);
        await existingPack.resume().catch(() => undefined);
        if (existingStatus) {
          await MapsRepository.updateRegionStatus(id, {
            status: 'downloading',
            progress: progressFromPackStatus(existingStatus),
            sizeBytes: sizeFromPackStatus(existingStatus),
            offlinePackId: existingPack.id,
          });
          this.notifyRegionDownload(id, 'downloading', progressFromPackStatus(existingStatus));
          this.scheduleDownloadWatchdog(
            id,
            existingPack.id,
            progressFromPackStatus(existingStatus)
          );
        }
        return { ok: true };
      }

      const pack = await maplibre.OfflineManager.createPack(
        {
          mapStyle: styleUrl,
          bounds: offlineBounds,
          minZoom: region.minZoom ?? undefined,
          maxZoom: region.maxZoom ?? undefined,
          metadata: {
            regionId: id,
            manifestRegionId: region.manifestRegionId,
            manifestVersion: region.manifestVersion,
            dataVersion: region.dataVersion,
            checksumSha256: region.checksumSha256,
            name: region.name,
          },
        },
        (offlinePack, status) => this.handlePackProgress(id, offlinePack.id, status),
        (_offlinePack, error) => this.handlePackError(id, error.message)
      );
      await pack.resume().catch(() => undefined);
      const status = await pack.status().catch(() => null);
      this.scheduleDownloadWatchdog(id, pack.id, status ? progressFromPackStatus(status) : 0);
      await MapsRepository.updateRegionStatus(id, {
        status: status && isOfflinePackComplete(status) ? 'downloaded' : 'downloading',
        progress: status ? progressFromPackStatus(status) : 0,
        sizeBytes: status ? sizeFromPackStatus(status) : null,
        offlinePackId: pack.id,
      });
      if (status && isOfflinePackComplete(status)) {
        this.notifyRegionDownload(id, 'completed', 1);
        this.completeRegionDownload(id);
      }
      return { ok: true };
    } catch (error) {
      await MapsRepository.updateRegionStatus(id, { status: 'failed', progress: 0 });
      this.notifyRegionDownload(id, 'failed', 0);
      this.completeRegionDownload(id);
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Offline map download failed.',
      };
    }
  }

  static listMarkers() {
    return MapsRepository.listMarkers();
  }

  static createMarker(input: {
    title: string;
    description?: string | null;
    pinType?: MapPinType;
    isEmergencyPin?: boolean;
    latitude: number;
    longitude: number;
    photoUri?: string | null;
    color?: string | null;
  }) {
    return MapsRepository.createMarker(input);
  }

  static async updateMarker(
    id: string,
    input: {
      title: string;
      description?: string | null;
      pinType?: MapPinType;
      isEmergencyPin?: boolean;
      photoUri?: string | null;
      color?: string | null;
    }
  ) {
    const marker = await MapsRepository.getMarker(id);
    if (!marker) throw new Error('Saved spot not found.');
    await MapsRepository.updateMarker(id, {
      title: input.title,
      description: input.description,
      pinType: input.pinType,
      isEmergencyPin: input.isEmergencyPin,
      photoUri: input.photoUri,
      color: input.color,
    });
    if (marker.photoUri && marker.photoUri !== (input.photoUri ?? null)) {
      await FileSystemService.deleteByUri(marker.photoUri).catch(() => undefined);
    }
  }

  static async createRegionFromMarkers(input: {
    name: string;
    markers: MapMarker[];
    paddingKm?: number;
    minZoom?: number;
    maxZoom?: number;
    estimatedSizeMb?: number | null;
    styleUrl?: string;
  }) {
    if (input.markers.length < 2) {
      throw new Error('Save at least two spots before planning a map region.');
    }
    return this.createRegionDownload({
      name: input.name,
      bounds: boundsForMarkers(input.markers, input.paddingKm ?? 5),
      minZoom: input.minZoom ?? 8,
      maxZoom: input.maxZoom ?? 15,
      estimatedSizeMb: input.estimatedSizeMb,
      styleUrl: input.styleUrl,
    });
  }

  static async createRegionFromBounds(input: {
    name: string;
    north: number;
    south: number;
    east: number;
    west: number;
    minZoom?: number;
    maxZoom?: number;
    estimatedSizeMb?: number | null;
    styleUrl?: string;
  }) {
    const bounds = validateBounds(input);
    const zoom = validateZoom(input.minZoom ?? 6, input.maxZoom ?? 13);
    return this.createRegionDownload({
      name: input.name.trim() || 'Custom offline region',
      bounds,
      minZoom: zoom.minZoom,
      maxZoom: zoom.maxZoom,
      estimatedSizeMb: input.estimatedSizeMb,
      styleUrl: input.styleUrl,
    });
  }

  static async createRegionFromViewport(input: {
    name?: string;
    bounds: [number, number, number, number];
    zoom?: number | null;
    styleUrl?: string;
  }) {
    const [west, south, east, north] = input.bounds;
    const zoom = viewportZoomRange(input.zoom);
    return this.createRegionFromBounds({
      name: input.name?.trim() || visibleAreaName({ north, south, east, west }),
      north,
      south,
      east,
      west,
      minZoom: zoom.minZoom,
      maxZoom: zoom.maxZoom,
      styleUrl: input.styleUrl,
    });
  }

  static async deleteMarker(id: string) {
    const marker = await MapsRepository.getMarker(id);
    if (marker?.photoUri)
      await FileSystemService.deleteByUri(marker.photoUri).catch(() => undefined);
    await RagCleanupService.removeSource(`map-marker:${id}`);
    return MapsRepository.deleteMarker(id);
  }

  static listRoutes() {
    return MapsRepository.listRoutes();
  }

  static downloadRoutingPack(regionId: string) {
    return OfflineRoutingService.downloadRoutingPack(regionId);
  }

  static startNavigation(input: {
    origin: RouteCoordinate;
    destination: RouteCoordinate;
    destinationTitle: string;
    profile: RoutingProfile;
    preferences?: RoutingPreferences;
    regionId?: string | null;
  }) {
    return OfflineRoutingService.startNavigation(input);
  }

  static getActiveNavigationSession() {
    return OfflineRoutingService.getActiveSession();
  }

  static stopNavigation(sessionId: string) {
    return OfflineRoutingService.stopNavigation(sessionId);
  }

  static async searchOffline(query: string, limit = 12): Promise<OfflineMapSearchResult[]> {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return [];
    const [markers, regions, routes, placeResults, tracks, fieldPreferences] = await Promise.all([
      MapsRepository.listMarkers(),
      MapsRepository.listRegions(),
      MapsRepository.listRoutes(),
      OfflinePlaceIndexService.search(normalized, Math.min(limit, 8)).catch(() => []),
      TracksRepository.searchTracks(normalized, Math.min(limit, 8)),
      PreferencesService.getFieldPreferences().catch(() => null),
    ]);
    const unitSystem = fieldPreferences?.unitSystem ?? 'metric';

    const markerResults = markers
      .filter((marker) =>
        matches(
          normalized,
          marker.title,
          marker.description,
          marker.pinType.replace('_', ' '),
          marker.isEmergencyPin ? 'emergency' : null
        )
      )
      .map<OfflineMapSearchResult>((marker) => ({
        id: marker.id,
        kind: 'spot',
        title: marker.title,
        subtitle: marker.description || formatPoint(marker.latitude, marker.longitude),
        latitude: marker.latitude,
        longitude: marker.longitude,
      }));

    const savedRegionResults = regions
      .filter((region) =>
        matches(
          normalized,
          region.name,
          region.status,
          region.manifestRegionId,
          region.provider,
          region.packFormat
        )
      )
      .map<OfflineMapSearchResult>((region) => {
        const center = centerForBounds(region);
        return {
          id: region.id,
          kind: 'region',
          title: region.name,
          subtitle: `${mapRegionStatusLabel(region.status)}${
            region.progress > 0 && region.progress < 1
              ? ` · ${Math.round(region.progress * 100)}%`
              : ''
          }`,
          latitude: center?.latitude ?? null,
          longitude: center?.longitude ?? null,
        };
      });

    const savedRegionIds = new Set(
      regions.map((region) => region.manifestRegionId).filter((id): id is string => !!id)
    );
    const presetRegionResults = MapPresetsService.search(normalized, limit)
      .filter((preset) => !savedRegionIds.has(preset.id))
      .map<OfflineMapSearchResult>((preset) => ({
        id: preset.id,
        kind: 'region',
        title: preset.name,
        subtitle: `available offline pack · ${preset.estimatedSize}`,
        latitude: preset.center[1],
        longitude: preset.center[0],
      }));

    const routeResults = routes
      .filter((route) =>
        matches(
          normalized,
          route.title,
          ...route.points.map((point) => point.title).filter((title): title is string => !!title)
        )
      )
      .map<OfflineMapSearchResult>((route) => ({
        id: route.id,
        kind: 'route',
        title: route.title,
        subtitle: `${route.points.length} points${
          route.distanceMeters ? ` · ${formatDistance(route.distanceMeters, unitSystem)}` : ''
        }`,
        latitude: route.points[0]?.latitude ?? null,
        longitude: route.points[0]?.longitude ?? null,
      }));

    const trackResults = tracks.map<OfflineMapSearchResult>((track) => ({
      id: track.id,
      kind: 'track',
      title: track.title,
      subtitle: `${track.activityType} · ${formatDistance(track.distanceMeters, unitSystem)}`,
      latitude: null,
      longitude: null,
    }));

    return [
      ...markerResults,
      ...placeResults,
      ...savedRegionResults,
      ...presetRegionResults,
      ...routeResults,
      ...trackResults,
    ].slice(0, limit);
  }

  static async createRouteFromMarkers(title: string, markers: MapMarker[]) {
    const points = markers.map<SavedRoutePoint>((marker) => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
      title: marker.title,
    }));
    return MapsRepository.createRoute({
      title,
      points,
      distanceMeters: routeDistanceMeters(points),
    });
  }

  static async deleteRoute(id: string) {
    await RagCleanupService.removeSource(`map-route:${id}`);
    return MapsRepository.deleteRoute(id);
  }

  private static completeRegionDownload(id: string) {
    this.clearDownloadWatchdog(id);
    if (this.activeRegionId === id) {
      this.activeRegionId = null;
      this.startNextQueuedRegion();
    }
  }

  private static async attachPackListeners(
    maplibre: MapLibreModule,
    regionId: string,
    packId: string
  ) {
    await maplibre.OfflineManager.addListener(
      packId,
      (offlinePack, status) => this.handlePackProgress(regionId, offlinePack.id, status),
      (_offlinePack, error) => this.handlePackError(regionId, error.message)
    ).catch(() => undefined);
  }

  private static handlePackProgress(
    regionId: string,
    packId: string,
    status: OfflinePackStatusLike
  ) {
    const completed = isOfflinePackComplete(status);
    const progress = progressFromPackStatus(status);
    void MapsRepository.updateRegionStatus(regionId, {
      status: completed ? 'downloaded' : 'downloading',
      progress,
      sizeBytes: sizeFromPackStatus(status),
      offlinePackId: packId,
    });
    this.notifyRegionDownload(regionId, completed ? 'completed' : 'downloading', progress);
    if (completed) this.completeRegionDownload(regionId);
    else this.scheduleDownloadWatchdog(regionId, packId, progress);
  }

  private static handlePackError(regionId: string, message?: string) {
    this.clearDownloadWatchdog(regionId);
    void MapsRepository.updateRegionStatus(regionId, { status: 'failed', progress: 0 });
    this.notifyRegionDownload(regionId, 'failed', 0);
    this.completeRegionDownload(regionId);
    if (message) logger.warn(message);
  }

  private static scheduleDownloadWatchdog(regionId: string, packId: string, progress: number) {
    const current = this.downloadWatchdogs.get(regionId);
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    if (current && normalizedProgress <= current.progress && current.packId === packId) return;

    if (current) clearTimeout(current.timer);
    const restarts = current?.restarts ?? 0;
    const timer = setTimeout(() => {
      void this.handleDownloadStall(regionId, packId, normalizedProgress, restarts);
    }, DOWNLOAD_STALL_TIMEOUT_MS);
    this.downloadWatchdogs.set(regionId, {
      packId,
      progress: normalizedProgress,
      restarts,
      timer,
    });
  }

  private static clearDownloadWatchdog(regionId: string) {
    const watchdog = this.downloadWatchdogs.get(regionId);
    if (!watchdog) return;
    clearTimeout(watchdog.timer);
    this.downloadWatchdogs.delete(regionId);
  }

  private static async handleDownloadStall(
    regionId: string,
    packId: string,
    stalledProgress: number,
    restarts: number
  ) {
    const watchdog = this.downloadWatchdogs.get(regionId);
    if (!watchdog || watchdog.packId !== packId || watchdog.progress !== stalledProgress) return;

    const region = await MapsRepository.getRegion(regionId);
    if (!region || region.status !== 'downloading') {
      this.clearDownloadWatchdog(regionId);
      return;
    }
    if (Math.abs(region.progress - stalledProgress) > 0.0001) {
      this.scheduleDownloadWatchdog(regionId, packId, region.progress);
      return;
    }

    const maplibre = await MapService.loadMapLibre();
    if (maplibre && restarts < MAX_STALL_RESTARTS) {
      try {
        const packs = await maplibre.OfflineManager.getPacks();
        const pack = packs.find((candidate) => candidate.id === packId);
        if (pack) {
          await pack.pause().catch(() => undefined);
          await pack.resume().catch(() => undefined);
          if (this.downloadWatchdogs.get(regionId) === watchdog) {
            clearTimeout(watchdog.timer);
            const timer = setTimeout(() => {
              void this.handleDownloadStall(regionId, packId, stalledProgress, restarts + 1);
            }, DOWNLOAD_STALL_TIMEOUT_MS);
            this.downloadWatchdogs.set(regionId, {
              packId,
              progress: stalledProgress,
              restarts: restarts + 1,
              timer,
            });
          }
          return;
        }
      } catch (error) {
        logger.warn(error instanceof Error ? error.message : 'Unable to restart stalled map pack.');
      }
    }

    this.clearDownloadWatchdog(regionId);
    await MapsRepository.updateRegionStatus(regionId, {
      status: 'failed',
      progress: stalledProgress,
    });
    this.notifyRegionDownload(regionId, 'failed', stalledProgress);
    this.completeRegionDownload(regionId);
  }

  private static notifyRegionDownload(
    regionId: string,
    status: 'downloading' | 'paused' | 'completed' | 'failed',
    progress: number
  ) {
    void MapsRepository.getRegion(regionId).then((region) => {
      const input = {
        id: `map-${regionId}`,
        kind: 'map' as const,
        title: region?.name ?? 'Offline map region',
        progress,
        status,
      };
      if (status === 'downloading') {
        return DownloadNotificationService.progress(input);
      }
      return DownloadNotificationService.terminal(input);
    });
  }

  private static startNextQueuedRegion() {
    if (this.startingQueuedRegion || this.activeRegionId) return;
    this.startingQueuedRegion = true;
    void MapsRepository.listRegions()
      .then((regions) => regions.find((region) => region.status === 'queued'))
      .then((region) => {
        if (region) return this.refreshRegion(region.id);
        return null;
      })
      .finally(() => {
        this.startingQueuedRegion = false;
      });
  }
}

function routeDistanceMeters(points: SavedRoutePoint[]) {
  return points
    .slice(1)
    .reduce((total, point, index) => total + routeSegmentMeters(points[index], point), 0);
}

function boundsForMarkers(markers: MapMarker[], paddingKm: number) {
  const latitudes = markers.map((marker) => marker.latitude);
  const longitudes = markers.map((marker) => marker.longitude);
  const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const latitudePadding = paddingKm / 111;
  const longitudePadding = paddingKm / (111 * Math.max(0.2, Math.cos(toRadians(centerLatitude))));
  return {
    north: Math.max(...latitudes) + latitudePadding,
    south: Math.min(...latitudes) - latitudePadding,
    east: Math.max(...longitudes) + longitudePadding,
    west: Math.min(...longitudes) - longitudePadding,
  };
}

function validateBounds(input: { north: number; south: number; east: number; west: number }) {
  const { north, south, east, west } = input;
  const values = [north, south, east, west];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Region bounds must be valid numbers.');
  }
  if (north > 90 || north < -90 || south > 90 || south < -90) {
    throw new Error('Latitude bounds must be between -90 and 90.');
  }
  if (east > 180 || east < -180 || west > 180 || west < -180) {
    throw new Error('Longitude bounds must be between -180 and 180.');
  }
  if (north <= south) {
    throw new Error('North must be greater than south.');
  }
  if (east <= west) {
    throw new Error('East must be greater than west for this region planner.');
  }
  return { north, south, east, west };
}

function validateZoom(minZoom: number, maxZoom: number) {
  if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom)) {
    throw new Error('Zoom levels must be valid numbers.');
  }
  const nextMin = Math.round(minZoom);
  const nextMax = Math.round(maxZoom);
  if (nextMin < 0 || nextMax > 22 || nextMin > nextMax) {
    throw new Error('Zoom levels must stay between 0 and 22, with minimum before maximum.');
  }
  return { minZoom: nextMin, maxZoom: nextMax };
}

function viewportZoomRange(zoom?: number | null) {
  const baseZoom = Number.isFinite(zoom) ? Number(zoom) : 9;
  const minZoom = clamp(Math.floor(baseZoom) - 1, 5, 13);
  const maxZoom = clamp(Math.ceil(baseZoom) + 4, Math.max(10, minZoom), 16);
  return validateZoom(minZoom, maxZoom);
}

function visibleAreaName(bounds: { north: number; south: number; east: number; west: number }) {
  const latitude = (bounds.north + bounds.south) / 2;
  const longitude = (bounds.east + bounds.west) / 2;
  return `Visible area ${formatPoint(latitude, longitude)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function matches(query: string, ...values: Array<string | null | undefined>) {
  return values.some((value) => value?.toLowerCase().includes(query));
}

function centerForBounds(region: {
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
}) {
  if (region.north == null || region.south == null || region.east == null || region.west == null) {
    return null;
  }
  return {
    latitude: (region.north + region.south) / 2,
    longitude: (region.east + region.west) / 2,
  };
}

function mapRegionStatusLabel(status: MapRegion['status']) {
  if (status === 'not_downloaded') return 'not downloaded';
  return status;
}

function isPackForRegion(
  candidate: { id: string; metadata?: Record<string, unknown> },
  region: MapRegion
) {
  const metadata = candidate.metadata ?? {};
  return (
    candidate.id === region.offlinePackId ||
    metadata.regionId === region.id ||
    (region.manifestRegionId != null && metadata.manifestRegionId === region.manifestRegionId) ||
    metadata.name === region.name
  );
}

function isOfflinePackComplete(status: OfflinePackStatusLike) {
  if (status.state === 'complete') return true;
  if (progressFromPackStatus(status) >= 1) return true;
  if (
    status.requiredResourceCount > 0 &&
    status.completedResourceCount >= status.requiredResourceCount
  ) {
    return true;
  }
  return false;
}

function progressFromPackStatus(
  status: Pick<
    OfflinePackStatusLike,
    'percentage' | 'completedResourceCount' | 'requiredResourceCount'
  >
) {
  if (status.requiredResourceCount > 0) {
    return Math.max(0, Math.min(1, status.completedResourceCount / status.requiredResourceCount));
  }
  const normalized = status.percentage > 1 ? status.percentage / 100 : status.percentage;
  return Math.max(0, Math.min(1, normalized));
}

function routeSegmentMeters(a: SavedRoutePoint, b: SavedRoutePoint) {
  return haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
}
