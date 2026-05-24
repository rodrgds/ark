import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export type MapLibreModule = typeof import('@maplibre/maplibre-react-native');
export type MapTheme = 'oled' | 'dark' | 'light';

export const LEGACY_DEMO_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
export const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const OPENMAPTILES_SOURCE_URL = 'https://tiles.openfreemap.org/planet';
const OPENMAPTILES_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const STYLE_REACHABILITY_TIMEOUT_MS = 4500;

const OPENFREEMAP_STYLE_URLS: Record<MapTheme, string> = {
  oled: 'https://tiles.openfreemap.org/styles/dark',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: DEFAULT_MAP_STYLE_URL,
};

const MAP_THEME_COLORS: Record<
  MapTheme,
  {
    background: string;
    land: string;
    water: string;
    landuse: string;
    road: string;
    primary: string;
    text: string;
    mutedText: string;
    border: string;
  }
> = {
  oled: {
    background: '#0d0d0d',
    land: '#0d0d0d',
    water: '#181d16',
    landuse: '#0c0f0b',
    road: '#313a2c',
    primary: '#95a78b',
    text: '#eae9fc',
    mutedText: '#afbda8',
    border: '#495742',
  },
  dark: {
    background: '#1a1a1a',
    land: '#1a1a1a',
    water: '#181d16',
    landuse: '#0c0f0b',
    road: '#313a2c',
    primary: '#95a78b',
    text: '#eae9fc',
    mutedText: '#afbda8',
    border: '#495742',
  },
  light: {
    background: '#f2f2f2',
    land: '#f2f2f2',
    water: '#e5e9e2',
    landuse: '#e5e9e2',
    road: '#cad3c5',
    primary: '#627458',
    text: '#050316',
    mutedText: '#4a5742',
    border: '#b0bda8',
  },
};

let modulePromise: Promise<MapLibreModule | null> | null = null;
let loggingConfigured = false;

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
      modulePromise = import('@maplibre/maplibre-react-native')
        .then((maplibre) => {
          this.configureLogging(maplibre);
          return maplibre;
        })
        .catch(() => null);
    }
    return modulePromise;
  }

  static configureLogging(maplibre: MapLibreModule | null) {
    if (!maplibre || loggingConfigured) return;
    const manager = maplibre.LogManager;
    if (!manager) return;
    loggingConfigured = true;
    manager.onLog((event) => {
      if (
        event.level === 'warn' &&
        event.tag === 'Mbgl-HttpRequest' &&
        isCanceledHttpRequest(event.message)
      ) {
        return true;
      }
      return false;
    });
  }

  static getDefaultStyleUrl(theme: MapTheme = 'light') {
    return process.env.EXPO_PUBLIC_ARK_MAP_STYLE_URL || OPENFREEMAP_STYLE_URLS[theme];
  }

  static getThemedStyle(theme: MapTheme): StyleSpecification | string {
    if (process.env.EXPO_PUBLIC_ARK_USE_JSON_MAP_STYLE === 'true')
      return createTacticalStyle(theme);
    return this.getDefaultStyleUrl(theme);
  }

  static getOverviewStyle(theme: MapTheme = 'oled'): StyleSpecification {
    return createOverviewStyle(theme);
  }

  static getLocalStyle(theme: MapTheme = 'oled'): StyleSpecification {
    return createTacticalStyle(theme);
  }

  static setNetworkConnected(maplibre: MapLibreModule | null, connected: boolean) {
    const manager = maplibre?.NetworkManager;
    if (!manager) return;
    try {
      manager.setConnected(connected);
    } catch {
      // The network manager is native-only. Expo Go and partial native builds can omit it.
    }
  }

  static async canReachStyle(theme: MapTheme = 'light') {
    return this.canReachStyleUrl(this.getDefaultStyleUrl(theme));
  }

  static async canReachStyleUrl(styleUrl: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STYLE_REACHABILITY_TIMEOUT_MS);
    try {
      const response = await fetch(styleUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  static isDemoStyle(styleUrl = this.getDefaultStyleUrl()) {
    return styleUrl === LEGACY_DEMO_MAP_STYLE_URL || styleUrl.includes('demotiles.maplibre.org');
  }
}

export function createOverviewStyle(theme: MapTheme): StyleSpecification {
  const colors = MAP_THEME_COLORS[theme];
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': colors.water,
        },
      },
    ],
  };
}

export function createTacticalStyle(theme: MapTheme): StyleSpecification {
  const colors = MAP_THEME_COLORS[theme];
  return {
    version: 8,
    glyphs: OPENMAPTILES_GLYPHS_URL,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: OPENMAPTILES_SOURCE_URL,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': colors.background,
        },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: {
          'fill-color': colors.landuse,
          'fill-opacity': theme === 'light' ? 0.55 : 0.42,
        },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        paint: {
          'fill-color': colors.landuse,
          'fill-opacity': theme === 'light' ? 0.45 : 0.34,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: {
          'fill-color': colors.water,
          'fill-opacity': 0.92,
        },
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        paint: {
          'line-color': colors.border,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 8, 0.8],
          'line-opacity': 0.65,
        },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]],
        paint: {
          'line-color': colors.road,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 14, 1.6, 18, 5],
          'line-opacity': theme === 'light' ? 0.62 : 0.78,
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary']]],
        paint: {
          'line-color': colors.primary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 10, 1.4, 15, 4.8],
          'line-opacity': 0.88,
        },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13],
        },
        paint: {
          'text-color': colors.mutedText,
          'text-halo-color': colors.background,
          'text-halo-width': 1.2,
        },
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 9, 14],
        },
        paint: {
          'text-color': colors.text,
          'text-halo-color': colors.background,
          'text-halo-width': 1.5,
        },
      },
    ],
  };
}

function isCanceledHttpRequest(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('canceled') || normalized.includes('cancel');
}
