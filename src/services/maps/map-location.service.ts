import * as Location from 'expo-location';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

export type MapLocationIssue = {
  kind: 'permission_denied' | 'timeout' | 'unavailable';
  canOpenSettings?: boolean;
};

export type MapLocationResolution = {
  lastKnown: Location.LocationObject | null;
  current: Location.LocationObject | null;
  issue: MapLocationIssue | null;
};

const LAST_KNOWN_LOCATION_MAX_AGE_MS = 10 * 60 * 1000;
const LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_M = 1500;
const FRESH_LOCATION_TIMEOUT_MS = 4000;
const FRESH_LOCATION_TIMEOUT_WITH_CACHE_MS = 2500;
const CACHED_LOCATION_KEY = 'maps.location.cached';

export class MapLocationService {
  static async getGrantedLocation() {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (loc) await this.cacheLocation(loc);
    return loc;
  }

  private static async cacheLocation(loc: Location.LocationObject) {
    try {
      await SettingsRepository.set(CACHED_LOCATION_KEY, JSON.stringify(loc));
    } catch {
      // Best effort
    }
  }

  private static async getCachedLocation(): Promise<Location.LocationObject | null> {
    try {
      const data = await SettingsRepository.get(CACHED_LOCATION_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // Ignore
    }
    return null;
  }

  static async resolveUserLocation(
    {
      requestPermission,
      showUserSettingsDialog,
    }: {
      requestPermission: boolean;
      showUserSettingsDialog: boolean;
    },
    onCached?: (location: Location.LocationObject) => void
  ): Promise<MapLocationResolution> {
    try {
      const permission = requestPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        return {
          lastKnown: null,
          current: null,
          issue: {
            kind: 'permission_denied',
            canOpenSettings: permission.canAskAgain === false,
          },
        };
      }

      let lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_M,
      }).catch(() => null);

      if (!lastKnown) {
        lastKnown = await this.getCachedLocation();
      }

      if (lastKnown && onCached) {
        onCached(lastKnown);
      }

      const current = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: showUserSettingsDialog,
        }),
        lastKnown ? FRESH_LOCATION_TIMEOUT_WITH_CACHE_MS : FRESH_LOCATION_TIMEOUT_MS
      ).catch(() => null);

      if (current) {
        await this.cacheLocation(current);
      } else if (lastKnown) {
        await this.cacheLocation(lastKnown);
      }

      return {
        lastKnown,
        current,
        issue: lastKnown || current ? null : { kind: 'timeout' },
      };
    } catch {
      return {
        lastKnown: null,
        current: null,
        issue: { kind: 'unavailable' },
      };
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

