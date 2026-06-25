import * as FileSystem from 'expo-file-system/legacy';
import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { FileDigestService } from '@/services/files/file-digest.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { DownloadNotificationService } from '@/services/files/download-notifications.service';
import { getDownloadedRegionForCoordinate } from '@/services/maps/map-region-utils';
import type {
  NavigationLocationUpdate,
  NavigationSession,
  OfflineRoute,
  RouteCoordinate,
  RoutingProfile,
} from '@/types/maps';

const OFF_ROUTE_DISTANCE_METERS = 45;
const OFF_ROUTE_CONFIRMATION_COUNT = 2;
const ARRIVAL_DISTANCE_METERS = 25;
const REROUTE_COOLDOWN_MS = 10_000;
const DIRECT_ROUTE_REGION_ID = 'direct';
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
        reason: 'Install a development build with the ArkRouting native module.',
      };
    }
    return routing.getEngineStatus();
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
      await FileSystemService.ensureSpaceForDownload();
      const download = FileSystem.createDownloadResumable(
        region.routingPackUrl,
        destination,
        {},
        (progress) => {
          const total = progress.totalBytesExpectedToWrite;
          if (!total) return;
          void MapsRepository.updateRegionRouting(regionId, {
            routingStatus: 'downloading',
            routingProgress: progress.totalBytesWritten / total,
            routingSizeBytes: progress.totalBytesWritten,
          });
        }
      );
      const result = await download.downloadAsync();
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
      try {
        const routing = await requireNativeRoutingModule();
        const result = await routing.calculateRoute({
          profile: input.profile,
          graphPath: normalizeFilePath(region.routingGraphUri),
          origin: input.origin,
          destination: input.destination,
        });

        if (!result.geometry.length) throw new Error('The routing engine returned an empty route.');

        return {
          profile: input.profile,
          regionId: region.id,
          routingMode: 'routed',
          geometry: result.geometry,
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          maneuvers: result.maneuvers,
          createdAt: Date.now(),
        };
      } catch {
        // Keep navigation usable when the app build does not have Valhalla
        // linked yet, or when a downloaded routing graph cannot be read.
      }
    }

    return buildDirectRoute(input.origin, input.destination, input.profile, region?.id);
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
    const directRoute =
      session.route.routingMode === 'direct'
        ? buildDirectRoute(location, session.destination, session.profile, session.regionId)
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
    throw new Error('Install a development build with ArkRouting native Valhalla support.');
  }
  return routing;
}

function normalizeFilePath(uri: string) {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

function buildDirectRoute(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
  profile: RoutingProfile,
  regionId?: string | null
): OfflineRoute {
  const distance = distanceMeters(origin, destination);
  const duration = distance / PROFILE_SPEED_METERS_PER_SECOND[profile];
  return {
    profile,
    regionId: regionId ?? DIRECT_ROUTE_REGION_ID,
    routingMode: 'direct',
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
