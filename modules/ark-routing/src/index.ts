import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type NativeRouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type NativeRoutingProfile = 'pedestrian' | 'bicycle' | 'car';

export type NativeRoutingPreferences = {
  avoidFerries?: boolean;
  avoidHills?: boolean;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
};

export type NativeRoutingRequest = {
  profile: NativeRoutingProfile;
  preferences?: NativeRoutingPreferences;
  graphPath: string;
  origin: NativeRouteCoordinate;
  destination: NativeRouteCoordinate;
};

export type NativeManeuver = {
  instruction: string;
  distanceMeters: number;
  durationSeconds?: number | null;
  streetName?: string | null;
  beginIndex: number;
  endIndex: number;
};

export type NativeRouteResult = {
  geometry: NativeRouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers: NativeManeuver[];
};

declare class ArkRoutingModule extends NativeModule {
  calculateRoute(request: NativeRoutingRequest): Promise<NativeRouteResult>;
  getEngineStatus(): Promise<{ available: boolean; engine: string; reason?: string }>;
}

export default requireNativeModule<ArkRoutingModule>('ArkRouting');
