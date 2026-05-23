export type MapLibreModule = typeof import('@maplibre/maplibre-react-native');

export const DEFAULT_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

let modulePromise: Promise<MapLibreModule | null> | null = null;

export class MapService {
  static getRuntimeStatus(maplibre?: MapLibreModule | null, checked = false) {
    if (!checked) {
      return {
        available: false,
        checking: true,
        reason: 'Checking whether the native MapLibre runtime is available.',
      };
    }
    if (maplibre) {
      return {
        available: true,
        checking: false,
        reason: 'MapLibre is available for map rendering and native offline packs.',
      };
    }
    return {
      available: false,
      checking: false,
      reason:
        'MapLibre is installed, but the native runtime is not loaded in this build. Use a development build for map rendering and native offline packs.',
    };
  }

  static async loadMapLibre() {
    if (!modulePromise) {
      modulePromise = import('@maplibre/maplibre-react-native').catch(() => null);
    }
    return modulePromise;
  }

  static getDefaultStyleUrl() {
    return process.env.EXPO_PUBLIC_ARK_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;
  }

  static isDemoStyle(styleUrl = this.getDefaultStyleUrl()) {
    return styleUrl === DEFAULT_MAP_STYLE_URL;
  }
}
