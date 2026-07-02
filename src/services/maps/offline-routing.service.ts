import * as FileSystem from 'expo-file-system/legacy';
import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { FileDigestService } from '@/services/files/file-digest.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { DownloadNotificationService } from '@/services/files/download-notifications.service';
import { getDownloadedRegionForCoordinate } from '@/services/maps/map-region-utils';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { estimatedRoutingPackBytesForPreset } from '@/services/maps/routing-storage';
import type {
  NavigationLocationUpdate,
  NavigationSession,
  OfflineRoute,
  RouteCoordinate,
  RoutingProfile,
  RoutingPackStatus,
} from '@/types/maps';

const OFF_ROUTE_DISTANCE_METERS = 45;
const OFF_ROUTE_CONFIRMATION_COUNT = 2;
const ARRIVAL_DISTANCE_METERS = 25;
const REROUTE_COOLDOWN_MS = 10_000;
const DIRECT_ROUTE_REGION_ID = 'direct';
const DOWNLOAD_STALL_TIMEOUT_MS = 30_000;
const MAX_STALL_RESTARTS = 1;
const ROUTE_ENDPOINT_TOLERANCE_METERS = 2_000;
const PROFILE_SPEED_METERS_PER_SECOND: Record<RoutingProfile, number> = {
  pedestrian: 1.35,
  bicycle: 4.5,
  car: 13.9,
};

type NativeRoutingModule = typeof import('ark-routing').default;

export class OfflineRoutingService {
  private static activeRoutingRegionId: string | null = null;

  static async getEngineStatus() {
    const routing = await loadNativeRoutingModule();
    if (!routing) {
      return {
        available: false,
        engine: 'valhalla',
        reason: 'ArkRouting native Valhalla support is not available in this installed build.',
      };
    }
    return routing.getEngineStatus();
  }

  static async getRoutingDataStatus() {
    const regions = await MapsRepository.listRegions();
    let readyCount = 0;
    let downloadingCount = 0;
    let failedCount = 0;
    let missingGraphCount = 0;
    const readyRegionNames: string[] = [];

    await Promise.all(
      regions.map(async (region) => {
        if (region.routingStatus === 'downloading' || region.routingStatus === 'queued') {
          downloadingCount += 1;
          return;
        }
        if (region.routingStatus === 'failed') {
          failedCount += 1;
          return;
        }
        if (region.routingStatus !== 'ready') return;

        if (!region.routingGraphUri) {
          missingGraphCount += 1;
          return;
        }

        const graphInfo = await FileSystem.getInfoAsync(region.routingGraphUri).catch(() => null);
        if (graphInfo?.exists) {
          readyCount += 1;
          readyRegionNames.push(region.name);
        } else {
          missingGraphCount += 1;
        }
      })
    );

    return {
      readyCount,
      readyRegionNames,
      downloadingCount,
      failedCount,
      missingGraphCount,
      message: routingDataStatusMessage({
        readyCount,
        readyRegionNames,
        downloadingCount,
        failedCount,
        missingGraphCount,
      }),
    };
  }

  static async downloadRoutingPack(regionId: string) {
    const region = await MapsRepository.getRegion(regionId);
    if (!region) return { ok: false, reason: 'Map region not found.' };
    if (!region.routingPackUrl) {
      await MapsRepository.updateRegionRouting(regionId, {
        routingStatus: 'failed',
        routingProgress: 0,
      });
      return { ok: false, reason: 'No routing graph is available for this map region yet.' };
    }

    if (region.routingStatus === 'ready' && region.routingGraphUri) {
      const exists = await FileSystem.getInfoAsync(region.routingGraphUri).catch(() => null);
      if (exists?.exists) {
        return { ok: true, regionId };
      }
      await MapsRepository.updateRegionRouting(regionId, {
        routingStatus: 'not_downloaded',
        routingProgress: 0,
        routingGraphUri: null,
      });
    }

    if (region.routingStatus === 'downloading') {
      return { ok: false, reason: 'A routing graph download is already in progress.' };
    }
    if (this.activeRoutingRegionId === regionId) {
      return { ok: false, reason: 'A routing graph download is already in progress.' };
    }

    const destination =
      region.routingGraphUri ??
      `${FileSystemService.dir('maps')}${FileSystemService.safeFileName(
        `${region.manifestRegionId ?? region.id}-routing.valhalla.tar`
      )}`;

    this.activeRoutingRegionId = regionId;
    await MapsRepository.updateRegionRouting(regionId, {
      routingStatus: 'downloading',
      routingProgress: 0,
      routingGraphUri: destination,
    });
    void DownloadNotificationService.progress({
      id: `routing-${regionId}`,
      kind: 'map',
      title: `${region.name} navigation`,
      progress: 0,
      status: 'downloading',
    });

    try {
      await FileSystemService.ensureAppDirectories();
      const catalogRegion = MapPresetsService.findPresetForRegion(region);
      await FileSystemService.ensureSpaceForDownload(
        estimatedRoutingPackBytesForPreset(catalogRegion),
        { alreadyOnDiskBytes: region.routingSizeBytes }
      );
      let result: FileSystem.FileSystemDownloadResult | undefined;
      let attempt = 0;
      while (!result) {
        try {
          result = await this.downloadRoutingPackFile({
            regionId,
            regionName: region.name,
            sourceUrl: region.routingPackUrl,
            destination,
          });
        } catch (downloadError) {
          if (downloadError instanceof RoutingDownloadStalledError && attempt < MAX_STALL_RESTARTS) {
            attempt += 1;
            await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
            await MapsRepository.updateRegionRouting(regionId, {
              routingStatus: 'downloading',
              routingProgress: 0,
              routingSizeBytes: null,
            });
            void DownloadNotificationService.progress({
              id: `routing-${regionId}`,
              kind: 'map',
              title: `${region.name} navigation`,
              progress: 0,
              status: 'downloading',
            });
            continue;
          }
          throw downloadError;
        }
      }
      if (!result?.uri) throw new Error('Routing graph download did not complete.');
      const info = await FileSystem.getInfoAsync(result.uri, { md5: false });
      const sizeBytes = info.exists && 'size' in info ? (info.size ?? null) : null;
      if (!sizeBytes || sizeBytes <= 0) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        throw new Error('Routing graph download is empty.');
      }

      if (region.routingChecksumSha256) {
        const digest = await FileDigestService.sha256FileIfReasonable(result.uri, sizeBytes).catch(
          () => null
        );
        if (
          digest?.checksumSha256 &&
          digest.checksumSha256.toLowerCase() !== region.routingChecksumSha256.toLowerCase()
        ) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
          throw new Error('Routing graph failed SHA-256 verification.');
        }
      }

      await MapsRepository.updateRegionRouting(regionId, {
        routingStatus: 'ready',
        routingProgress: 1,
        routingGraphUri: result.uri,
        routingSizeBytes: sizeBytes,
      });
      void DownloadNotificationService.terminal({
        id: `routing-${regionId}`,
        kind: 'map',
        title: `${region.name} navigation`,
        progress: 1,
        status: 'completed',
      });
      return { ok: true, regionId };
    } catch (error) {
      await MapsRepository.updateRegionRouting(regionId, {
        routingStatus: 'failed',
        routingProgress: 0,
      });
      void DownloadNotificationService.terminal({
        id: `routing-${regionId}`,
        kind: 'map',
        title: `${region.name} navigation`,
        progress: 0,
        status: 'failed',
      });
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Routing graph download failed.',
      };
    } finally {
      if (this.activeRoutingRegionId === regionId) this.activeRoutingRegionId = null;
    }
  }

  private static async downloadRoutingPackFile(input: {
    regionId: string;
    regionName: string;
    sourceUrl: string;
    destination: string;
  }) {
    let download: FileSystem.DownloadResumable | null = null;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let stalled = false;
    let lastBytes = -1;
    let lastProgress = -1;

    const clearStallTimer = () => {
      if (!stallTimer) return;
      clearTimeout(stallTimer);
      stallTimer = null;
    };
    const armStallTimer = () => {
      clearStallTimer();
      stallTimer = setTimeout(() => {
        stalled = true;
        void download?.cancelAsync().catch(() => undefined);
      }, DOWNLOAD_STALL_TIMEOUT_MS);
    };

    try {
      await FileSystem.deleteAsync(input.destination, { idempotent: true }).catch(() => undefined);
      download = FileSystem.createDownloadResumable(
        input.sourceUrl,
        input.destination,
        {},
        (progress) => {
          const total = progress.totalBytesExpectedToWrite;
          const downloadedBytes = progress.totalBytesWritten;
          const normalizedProgress = total ? downloadedBytes / total : 0;
          const moved =
            downloadedBytes > lastBytes ||
            (total > 0 && normalizedProgress > lastProgress + 0.0001);
          if (!moved) return;
          lastBytes = downloadedBytes;
          lastProgress = normalizedProgress;
          armStallTimer();
          if (!total) return;
          void MapsRepository.updateRegionRouting(input.regionId, {
            routingStatus: 'downloading',
            routingProgress: normalizedProgress,
            routingSizeBytes: downloadedBytes,
          });
          void DownloadNotificationService.progress({
            id: `routing-${input.regionId}`,
            kind: 'map',
            title: `${input.regionName} navigation`,
            progress: normalizedProgress,
            status: 'downloading',
          });
        }
      );
      armStallTimer();
      const result = await download.downloadAsync();
      if (stalled) throw new RoutingDownloadStalledError();
      return result;
    } catch (error) {
      if (stalled) throw new RoutingDownloadStalledError();
      throw error;
    } finally {
      clearStallTimer();
    }
  }

  static async calculateRoute(input: {
    origin: RouteCoordinate;
    destination: RouteCoordinate;
    profile: RoutingProfile;
    regionId?: string | null;
  }): Promise<OfflineRoute> {
    const regions = await MapsRepository.listRegions();
    const region =
      (input.regionId ? regions.find((candidate) => candidate.id === input.regionId) : null) ??
      getDownloadedRegionForCoordinate(input.origin.latitude, input.origin.longitude, regions);

    if (region?.routingStatus === 'ready' && region.routingGraphUri) {
      const graphInfo = await FileSystem.getInfoAsync(region.routingGraphUri).catch(() => null);
      if (!graphInfo?.exists) {
        await MapsRepository.updateRegionRouting(region.id, {
          routingStatus: 'not_downloaded',
          routingProgress: 0,
          routingGraphUri: null,
        });
        return buildDirectRoute(input.origin, input.destination, input.profile, region.id, {
          reason: 'navigation_graph_missing',
          message: 'Navigation data is missing from this device.',
        });
      }
      try {
        const routing = await requireNativeRoutingModule();
        const result = await routing.calculateRoute({
          profile: input.profile,
          graphPath: normalizeFilePath(region.routingGraphUri),
          origin: input.origin,
          destination: input.destination,
        });

        const geometry = normalizeRouteGeometry(result.geometry);
        if (!geometry.length) throw new Error('The routing engine returned an empty route.');
        if (!routeGeometryMatchesEndpoints(geometry, input.origin, input.destination)) {
          throw new Error('The routing engine returned route geometry outside the requested area.');
        }

        return {
          profile: input.profile,
          regionId: region.id,
          routingMode: 'routed',
          geometry,
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          maneuvers: result.maneuvers,
          createdAt: Date.now(),
        };
      } catch (error) {
        return buildDirectRoute(input.origin, input.destination, input.profile, region.id, {
          reason: isEngineUnavailableError(error)
            ? 'engine_unavailable'
            : 'route_calculation_failed',
          message: isEngineUnavailableError(error)
            ? 'Routing engine unavailable in this build.'
            : routeFailureMessage(error),
        });
      }
    }

    return buildDirectRoute(input.origin, input.destination, input.profile, region?.id, {
      reason: fallbackReasonForRegion(region?.routingStatus),
      message: fallbackMessageForRegion(region?.routingStatus),
    });
  }

  static async startNavigation(input: {
    origin: RouteCoordinate;
    destination: RouteCoordinate;
    destinationTitle: string;
    profile: RoutingProfile;
    regionId?: string | null;
  }) {
    const route = await this.calculateRoute(input);
    const sessionId = await MapsRepository.createNavigationSession({
      destinationTitle: input.destinationTitle,
      destination: input.destination,
      profile: input.profile,
      regionId: route.regionId,
      route,
    });
    const session = await MapsRepository.getActiveNavigationSession();
    if (!session || session.id !== sessionId) throw new Error('Unable to start navigation.');
    return session;
  }

  static getActiveSession() {
    return MapsRepository.getActiveNavigationSession();
  }

  static async stopNavigation(sessionId: string) {
    await MapsRepository.updateNavigationSession(sessionId, { status: 'stopped' });
  }

  static async updateLocation(
    session: NavigationSession,
    location: RouteCoordinate
  ): Promise<NavigationLocationUpdate> {
    if (
      session.route.routingMode !== 'direct' &&
      !routeGeometryMatchesEndpoints(session.route.geometry, location, session.destination)
    ) {
      const route = await this.calculateRoute({
        origin: location,
        destination: session.destination,
        profile: session.profile,
        regionId: session.regionId,
      });
      const progress = routeProgress(route, location);
      const arrived = distanceMeters(location, session.destination) <= ARRIVAL_DISTANCE_METERS;

      await MapsRepository.updateNavigationSession(session.id, {
        route,
        status: arrived ? 'arrived' : 'active',
        remainingDistanceMeters: progress.remainingDistanceMeters,
        currentManeuverIndex: progress.currentManeuverIndex,
        offRouteCount: 0,
        lastLocation: location,
        lastReroutedAt: Date.now(),
      });

      const nextSession = (await MapsRepository.getActiveNavigationSession()) ?? {
        ...session,
        route,
        status: arrived ? 'arrived' : 'active',
        remainingDistanceMeters: progress.remainingDistanceMeters,
        currentManeuverIndex: progress.currentManeuverIndex,
        offRouteCount: 0,
        lastLocation: location,
        lastReroutedAt: Date.now(),
        updatedAt: Date.now(),
      };

      return {
        session: nextSession,
        nearestDistanceMeters: progress.nearestDistanceMeters,
        shouldRecalculate: false,
        arrived,
      };
    }

    const directRoute =
      session.route.routingMode === 'direct'
        ? buildDirectRoute(location, session.destination, session.profile, session.regionId, {
            reason: session.route.routingFallbackReason ?? 'route_calculation_failed',
            message:
              session.route.routingFallbackMessage ??
              'Road routing is unavailable for this active navigation.',
          })
        : null;
    const route = directRoute ?? session.route;
    const progress = routeProgress(route, location);
    const arrived = distanceMeters(location, session.destination) <= ARRIVAL_DISTANCE_METERS;
    const offRouteCount =
      route.routingMode !== 'direct' && progress.nearestDistanceMeters > OFF_ROUTE_DISTANCE_METERS
        ? session.offRouteCount + 1
        : 0;
    const shouldRecalculate =
      route.routingMode !== 'direct' &&
      !arrived &&
      offRouteCount >= OFF_ROUTE_CONFIRMATION_COUNT &&
      Date.now() - (session.lastReroutedAt ?? 0) > REROUTE_COOLDOWN_MS;

    await MapsRepository.updateNavigationSession(session.id, {
      route: directRoute ?? undefined,
      status: arrived ? 'arrived' : shouldRecalculate ? 'rerouting' : 'active',
      remainingDistanceMeters: progress.remainingDistanceMeters,
      currentManeuverIndex: progress.currentManeuverIndex,
      offRouteCount,
      lastLocation: location,
    });

    const nextSession = (await MapsRepository.getActiveNavigationSession()) ?? {
      ...session,
      route,
      status: arrived ? 'arrived' : shouldRecalculate ? 'rerouting' : 'active',
      remainingDistanceMeters: progress.remainingDistanceMeters,
      currentManeuverIndex: progress.currentManeuverIndex,
      offRouteCount,
      lastLocation: location,
      updatedAt: Date.now(),
    };

    return {
      session: nextSession,
      nearestDistanceMeters: progress.nearestDistanceMeters,
      shouldRecalculate,
      arrived,
    };
  }

  static async recalculate(session: NavigationSession, origin: RouteCoordinate) {
    const route = await this.calculateRoute({
      origin,
      destination: session.destination,
      profile: session.profile,
      regionId: session.regionId,
    });
    await MapsRepository.updateNavigationSession(session.id, {
      route,
      status: 'active',
      remainingDistanceMeters: route.distanceMeters,
      currentManeuverIndex: 0,
      offRouteCount: 0,
      lastLocation: origin,
      lastReroutedAt: Date.now(),
    });
    return (await MapsRepository.getActiveNavigationSession()) ?? session;
  }
}

class RoutingDownloadStalledError extends Error {
  constructor() {
    super('Routing graph download stalled for 30 seconds with no progress.');
    this.name = 'RoutingDownloadStalledError';
  }
}

async function loadNativeRoutingModule(): Promise<NativeRoutingModule | null> {
  try {
    // Local Expo module, resolved by native autolinking in development/release builds.
    return (await import('ark-routing')).default;
  } catch {
    return null;
  }
}

async function requireNativeRoutingModule() {
  const routing = await loadNativeRoutingModule();
  if (!routing) {
    throw new Error('ArkRouting native Valhalla support is not available in this installed build.');
  }
  return routing;
}

function normalizeFilePath(uri: string) {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

function isEngineUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('ArkRouting native Valhalla support') ||
    error.message.includes('Valhalla native routing engine could not be loaded') ||
    error.message.includes('E_ROUTING_ENGINE_UNAVAILABLE')
  );
}

function routeFailureMessage(error: unknown) {
  const detail = error instanceof Error ? error.message.trim() : '';
  if (!detail) return 'Navigation graph could not calculate a road route.';
  return `Road route failed: ${detail}`;
}

function fallbackReasonForRegion(
  routingStatus?: RoutingPackStatus | null
): NonNullable<OfflineRoute['routingFallbackReason']> {
  if (!routingStatus) return 'no_region';
  if (routingStatus === 'downloading' || routingStatus === 'queued') return 'navigation_downloading';
  if (routingStatus === 'failed') return 'navigation_failed';
  return 'navigation_not_downloaded';
}

function fallbackMessageForRegion(routingStatus?: RoutingPackStatus | null) {
  if (!routingStatus) return 'No downloaded map with navigation covers your starting point.';
  if (routingStatus === 'downloading' || routingStatus === 'queued') {
    return 'Navigation data is still downloading.';
  }
  if (routingStatus === 'failed') return 'Navigation data failed to download.';
  return 'Navigation data is not downloaded for this area.';
}

function routingDataStatusMessage(status: {
  readyCount: number;
  readyRegionNames: string[];
  downloadingCount: number;
  failedCount: number;
  missingGraphCount: number;
}) {
  if (status.readyCount > 0) {
    const [first, second] = status.readyRegionNames;
    const label =
      status.readyCount === 1
        ? (first ?? '1 region')
        : second
          ? `${first}, ${second}${status.readyCount > 2 ? ` +${status.readyCount - 2}` : ''}`
          : `${status.readyCount} regions`;
    return `Navigation data ready for ${label}.`;
  }
  if (status.missingGraphCount > 0) {
    return 'Navigation data was marked ready but the graph file is missing. Retry the navigation download.';
  }
  if (status.downloadingCount > 0) {
    return 'Navigation data is still downloading.';
  }
  if (status.failedCount > 0) {
    return 'Navigation data failed to download. Retry it from Downloads or Offline Maps.';
  }
  return 'No offline navigation data is downloaded yet.';
}

function buildDirectRoute(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
  profile: RoutingProfile,
  regionId?: string | null,
  fallback?: {
    reason: NonNullable<OfflineRoute['routingFallbackReason']>;
    message: string;
  }
): OfflineRoute {
  const distance = distanceMeters(origin, destination);
  const duration = distance / PROFILE_SPEED_METERS_PER_SECOND[profile];
  return {
    profile,
    regionId: regionId ?? DIRECT_ROUTE_REGION_ID,
    routingMode: 'direct',
    routingFallbackReason: fallback?.reason,
    routingFallbackMessage: fallback?.message,
    geometry: [origin, destination],
    distanceMeters: distance,
    durationSeconds: duration,
    maneuvers: [
      {
        instruction: 'Head directly toward the destination.',
        distanceMeters: distance,
        durationSeconds: duration,
        beginIndex: 0,
        endIndex: 1,
      },
    ],
    createdAt: Date.now(),
  };
}

function normalizeRouteGeometry(geometry: RouteCoordinate[]) {
  return geometry.filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180
  );
}

function routeGeometryMatchesEndpoints(
  geometry: RouteCoordinate[],
  origin: RouteCoordinate,
  destination: RouteCoordinate
) {
  if (geometry.length < 2) return false;
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  return (
    Math.min(distanceMeters(first, origin), distanceMeters(last, origin)) <=
      ROUTE_ENDPOINT_TOLERANCE_METERS &&
    Math.min(distanceMeters(first, destination), distanceMeters(last, destination)) <=
      ROUTE_ENDPOINT_TOLERANCE_METERS
  );
}

function routeProgress(route: OfflineRoute, location: RouteCoordinate) {
  if (route.geometry.length === 0) {
    return {
      nearestDistanceMeters: Number.POSITIVE_INFINITY,
      remainingDistanceMeters: null,
      currentManeuverIndex: 0,
    };
  }

  if (route.geometry.length === 1) {
    const distance = distanceMeters(location, route.geometry[0]);
    return {
      nearestDistanceMeters: distance,
      remainingDistanceMeters: distance,
      currentManeuverIndex: 0,
    };
  }

  let nearestSegmentIndex = 0;
  let nearestSegmentProgress = 0;
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;
  const segmentLengths: number[] = [];

  for (let index = 0; index < route.geometry.length - 1; index += 1) {
    const segment = routeSegmentProgress(
      route.geometry[index],
      route.geometry[index + 1],
      location
    );
    segmentLengths.push(segment.lengthMeters);
    if (segment.distanceMeters < nearestDistanceMeters) {
      nearestDistanceMeters = segment.distanceMeters;
      nearestSegmentIndex = index;
      nearestSegmentProgress = segment.progress;
    }
  }

  const remainingDistanceMeters = segmentLengths
    .slice(nearestSegmentIndex + 1)
    .reduce(
      (total, length) => total + length,
      segmentLengths[nearestSegmentIndex] * (1 - nearestSegmentProgress)
    );

  return {
    nearestDistanceMeters,
    remainingDistanceMeters,
    currentManeuverIndex: maneuverIndexForSegment(route, nearestSegmentIndex),
  };
}

function routeSegmentProgress(
  start: RouteCoordinate,
  end: RouteCoordinate,
  location: RouteCoordinate
) {
  const metersPerLatitude = 111_320;
  const referenceLatitude = toRadians((start.latitude + end.latitude + location.latitude) / 3);
  const metersPerLongitude = Math.max(1, metersPerLatitude * Math.cos(referenceLatitude));
  const startX = (start.longitude - location.longitude) * metersPerLongitude;
  const startY = (start.latitude - location.latitude) * metersPerLatitude;
  const endX = (end.longitude - location.longitude) * metersPerLongitude;
  const endY = (end.latitude - location.latitude) * metersPerLatitude;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const progress =
    segmentLengthSquared > 0
      ? Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / segmentLengthSquared))
      : 0;
  const closestX = startX + segmentX * progress;
  const closestY = startY + segmentY * progress;

  return {
    distanceMeters: Math.hypot(closestX, closestY),
    lengthMeters: distanceMeters(start, end),
    progress,
  };
}

function maneuverIndexForSegment(route: OfflineRoute, segmentIndex: number) {
  const index = route.maneuvers.findIndex(
    (maneuver) => segmentIndex >= maneuver.beginIndex && segmentIndex <= maneuver.endIndex
  );
  return index >= 0 ? index : 0;
}

function distanceMeters(a: RouteCoordinate, b: RouteCoordinate) {
  const latA = toRadians(a.latitude);
  const latB = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
