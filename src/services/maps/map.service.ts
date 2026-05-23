export type MapLibreModule = typeof import('@maplibre/maplibre-react-native');

let modulePromise: Promise<MapLibreModule | null> | null = null;

export class MapService {
  static getRuntimeStatus() {
    return {
      available: true,
      reason:
        '@maplibre/maplibre-react-native is installed. Rendering requires a development build, not Expo Go.',
    };
  }

  static async loadMapLibre() {
    if (!modulePromise) {
      modulePromise = import('@maplibre/maplibre-react-native').catch(() => null);
    }
    return modulePromise;
  }
}
