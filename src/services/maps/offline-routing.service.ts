import * as FileSystem from 'expo-file-system/legacy';
import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
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

type NativeRoutingModule = typeof import('ark-routing').default;

export class OfflineRoutingService {
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

    const destination = `${FileSystemService.dir('maps')}${FileSystemService.safeFileName(
      `${region.manifestRegionId ?? region.id}-routing.valhalla.tar`
    )}`;

    await MapsRepository.updateRegionRouting(regionId, {
      routingStatus: 'downloading',
      routingProgress: 0,
      routingGraphUri: destination,
    });

    try {
      await FileSystemService.ensureAppDirectories();
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
      await MapsRepository.updateRegionRouting(regionId, {
        routingStatus: 'ready',
        routingProgress: 1,
        routingGraphUri: result.uri,
        routingSizeBytes: sizeBytes,
      });
      return { ok: true, regionId };
    } catch (error) {
      await MapsRepository.updateRegionRouting(regionId, {
        routingStatus: 'failed',
        routingProgress: 0,
      });
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Routing graph download failed.',
      };
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
    if (!region) {
      throw new Error('Download this area before calculating an offline route.');
    }
    if (region.routingStatus !== 'ready' || !region.routingGraphUri) {
      throw new Error('Download routing data for this map region before navigating.');
    }

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
      geometry: result.geometry,
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
      maneuvers: result.maneuvers,
      createdAt: Date.now(),
    };
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
    const progress = routeProgress(session.route.geometry, location);
    const arrived = distanceMeters(location, session.destination) <= ARRIVAL_DISTANCE_METERS;
    const offRouteCount =
      progress.nearestDistanceMeters > OFF_ROUTE_DISTANCE_METERS ? session.offRouteCount + 1 : 0;
    const shouldRecalculate =
      !arrived &&
      offRouteCount >= OFF_ROUTE_CONFIRMATION_COUNT &&
      Date.now() - (session.lastReroutedAt ?? 0) > REROUTE_COOLDOWN_MS;

    await MapsRepository.updateNavigationSession(session.id, {
      status: arrived ? 'arrived' : shouldRecalculate ? 'rerouting' : 'active',
      remainingDistanceMeters: progress.remainingDistanceMeters,
      currentManeuverIndex: progress.currentManeuverIndex,
      offRouteCount,
      lastLocation: location,
    });

    const nextSession = (await MapsRepository.getActiveNavigationSession()) ?? {
      ...session,
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

function routeProgress(route: RouteCoordinate[], location: RouteCoordinate) {
  if (route.length === 0) {
    return {
      nearestDistanceMeters: Number.POSITIVE_INFINITY,
      remainingDistanceMeters: null,
      currentManeuverIndex: 0,
    };
  }

  let nearestIndex = 0;
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;
  for (const [index, point] of route.entries()) {
    const distance = distanceMeters(location, point);
    if (distance < nearestDistanceMeters) {
      nearestDistanceMeters = distance;
      nearestIndex = index;
    }
  }

  let remainingDistanceMeters = 0;
  for (let index = nearestIndex; index < route.length - 1; index += 1) {
    remainingDistanceMeters += distanceMeters(route[index], route[index + 1]);
  }

  return {
    nearestDistanceMeters,
    remainingDistanceMeters,
    currentManeuverIndex: nearestIndex,
  };
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
