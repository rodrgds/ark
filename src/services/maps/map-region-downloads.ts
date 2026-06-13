import type { MapPreset } from '@/constants/map-presets';
import type { MapRegion } from '@/types/maps';

export type MapTheme = 'oled' | 'dark' | 'light';

type RegionDownloadInput = {
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
};

type MapLibreModule = {
  OfflineManager?: {
    getPacks?: unknown;
    createPack?: unknown;
    addListener?: unknown;
  };
} | null;

const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_STYLE_URLS: Record<MapTheme, string> = {
  oled: 'https://tiles.openfreemap.org/styles/dark',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: DEFAULT_MAP_STYLE_URL,
};

export function presetToRegionDownloadInput(
  preset: MapPreset,
  options: {
    theme: MapTheme;
    catalogVersion?: number;
  }
): RegionDownloadInput {
  return {
    name: preset.name,
    manifestRegionId: preset.id,
    manifestVersion: options.catalogVersion ?? 1,
    bounds: preset.bounds,
    minZoom: preset.minZoom,
    maxZoom: preset.maxZoom,
    estimatedSizeMb: preset.estimatedSizeMb,
    styleUrl: preset.styleUrl ?? getDefaultMapStyleUrl(options.theme),
    tileUrlTemplate: preset.tileUrlTemplate,
    packFormat: preset.packFormat,
    packUrl: preset.packUrl,
    dataVersion: preset.dataVersion,
    checksumSha256: preset.checksumSha256,
    checksumSha256Url: preset.checksumSha256Url,
    regionUpdatedAt: preset.updatedAt,
  };
}

export async function ensurePresetRegionDownload(
  preset: MapPreset,
  options: {
    theme: MapTheme;
    catalogVersion?: number;
    regions?: MapRegion[];
  }
) {
  const { OfflineMapService } = await import('@/services/maps/offline-map.service');
  const catalogVersion = options.catalogVersion ?? (await getActiveCatalogVersion());
  const regions = options.regions ?? (await OfflineMapService.listRegions());
  const existing = regions.find(
    (region) => region.manifestRegionId === preset.id || region.name === preset.name
  );
  if (existing) return existing.id;
  return OfflineMapService.createRegionDownload(
    presetToRegionDownloadInput(preset, { ...options, catalogVersion })
  );
}

export async function startPresetRegionDownload(
  preset: MapPreset,
  options: {
    theme: MapTheme;
    catalogVersion?: number;
    regions?: MapRegion[];
  }
) {
  const regionId = await ensurePresetRegionDownload(preset, options);
  const { MapService } = await import('@/services/maps/map.service');
  const maplibre = await MapService.loadMapLibre();
  if (!hasNativeOfflineManager(maplibre)) {
    return {
      ok: false,
      queued: true,
      regionId,
      reason:
        'Map download is queued. Install a development build with MapLibre native offline packs to start downloading map tiles.',
    };
  }

  const { OfflineMapService } = await import('@/services/maps/offline-map.service');
  const result = await OfflineMapService.refreshRegion(regionId);
  return {
    ...result,
    queued: false,
    regionId,
  };
}

function hasNativeOfflineManager(maplibre: MapLibreModule | null) {
  const manager = maplibre?.OfflineManager;
  return Boolean(
    manager &&
    typeof manager.getPacks === 'function' &&
    typeof manager.createPack === 'function' &&
    typeof manager.addListener === 'function'
  );
}

function getDefaultMapStyleUrl(theme: MapTheme = 'light') {
  return process.env.EXPO_PUBLIC_ARK_MAP_STYLE_URL || OPENFREEMAP_STYLE_URLS[theme];
}

async function getActiveCatalogVersion() {
  const { MapPresetsService } = await import('@/services/maps/map-presets.service');
  return MapPresetsService.getCatalogMeta().version;
}
