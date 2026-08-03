import { PermissionsAndroid, Platform } from 'react-native';
import { NitroFusedLocation } from 'react-native-nitro-fused-location';

/**
 * F-Droid backing for `expo-location`.
 *
 * `expo-location` depends on Google Play Services location, which F-Droid's
 * binary scanner rejects. This shim provides the small subset of the
 * `expo-location` API Ark uses, backed by `react-native-nitro-fused-location`
 * (a pure `android.location.LocationManager` module with no Google dependency).
 *
 * The metro config routes `expo-location` to this file only for the fdroid
 * distribution, and `react-native.config.js` excludes the `expo-location`
 * native module so its gms classes never compile into the APK.
 *
 * Background (foreground-service) tracking is intentionally not provided here:
 * Ark's track recording relies on the foreground `watchPositionAsync` stream
 * on this flavor.
 */

export type LocationObjectCoords = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
};

export type LocationObject = {
  coords: LocationObjectCoords;
  timestamp: number;
  mocked: boolean | null;
};

export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
  NearestTenMeters: 7,
  HundredMeters: 8,
  Kilometer: 9,
  ThreeKilometers: 10,
} as const;

export const LocationAccuracy = Accuracy;

export const ActivityType = {
  Other: 1,
  AutomotiveNavigation: 2,
  Fitness: 3,
  OtherNavigation: 4,
  Airborne: 5,
} as const;

export const LocationActivityType = ActivityType;

export const PermissionStatus = {
  GRANTED: 'granted',
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
} as const;

export type PermissionResponse = {
  granted: boolean;
  status: keyof typeof PermissionStatus | string;
  canAskAgain: boolean;
  isTransient?: boolean;
  expires?: 'never' | number | null;
};

type LocationDataType = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
};

function mapPermission(granted: boolean, canAskAgain: boolean): PermissionResponse {
  return {
    granted,
    status: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
    canAskAgain,
    isTransient: false,
    expires: 'never',
  };
}

async function checkFine(): Promise<boolean> {
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  } catch {
    return false;
  }
}

async function requestFine(): Promise<boolean> {
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (result === 'granted') return true;
  } catch {
    return false;
  }
  try {
    const coarse = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
    );
    return coarse === 'granted';
  } catch {
    return false;
  }
}

function checkBackground(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION!).catch(
    () => false
  );
}

async function requestBackground(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION!,
      {
        title: 'Background location',
        message: 'Ark uses your location in the background so track recording keeps running.',
        buttonPositive: 'Allow',
      }
    );
    return result === 'granted';
  } catch {
    return false;
  }
}

async function locationPermissionGranted(): Promise<boolean> {
  const fine = await checkFine();
  if (fine) return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
  } catch {
    return false;
  }
}

export async function getForegroundPermissionsAsync(): Promise<PermissionResponse> {
  const granted = await locationPermissionGranted();
  return mapPermission(granted, true);
}

export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  const granted = await requestFine();
  return mapPermission(granted, true);
}

export async function getBackgroundPermissionsAsync(): Promise<PermissionResponse> {
  const [granted, foregroundGranted] = await Promise.all([checkBackground(), checkFine()]);
  return mapPermission(granted || foregroundGranted, true);
}

export async function requestBackgroundPermissionsAsync(): Promise<PermissionResponse> {
  const granted = await requestBackground();
  if (!granted) return requestForegroundPermissionsAsync();
  return mapPermission(granted, true);
}

function toLocationObject(raw: LocationDataType): LocationObject {
  return {
    coords: {
      latitude: raw.latitude,
      longitude: raw.longitude,
      altitude: null,
      accuracy: raw.accuracy || null,
      altitudeAccuracy: null,
      heading: null,
      speed: raw.speed || null,
    },
    timestamp: Date.now(),
    mocked: false,
  };
}

export async function getCurrentPositionAsync(): Promise<LocationObject> {
  const raw = await NitroFusedLocation.getCurrentLocation();
  return toLocationObject(raw);
}

export async function getLastKnownPositionAsync(): Promise<LocationObject> {
  const raw = await NitroFusedLocation.getCurrentLocation();
  return toLocationObject(raw);
}

export type LocationSubscription = { remove(): void };

export async function watchPositionAsync(
  _options?: {
    accuracy?: number;
    timeInterval?: number;
    distanceInterval?: number;
  },
  callback?: (location: LocationObject) => void
): Promise<LocationSubscription> {
  const watchId = await NitroFusedLocation.watchPosition();
  const listener = (raw: LocationDataType) => {
    callback?.(toLocationObject(raw));
  };
  NitroFusedLocation.addLocationListener(listener);
  return {
    remove: async () => {
      NitroFusedLocation.removeLocationListener(listener);
      await NitroFusedLocation.clearWatch(watchId);
    },
  };
}

let hasStarted = false;

export async function hasStartedLocationUpdatesAsync(): Promise<boolean> {
  return hasStarted;
}

export async function startLocationUpdatesAsync(): Promise<void> {
  hasStarted = true;
  await NitroFusedLocation.resetDistance();
}

export async function stopLocationUpdatesAsync(): Promise<void> {
  hasStarted = false;
}

// @deprecated aliases for the legacy geolocation API (unused by Ark).
export const requestPermission = requestForegroundPermissionsAsync;
export const getPermission = getForegroundPermissionsAsync;
