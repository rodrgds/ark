import type { MapPreset } from '@/constants/map-presets';
import { MapService, type MapTheme } from '@/services/maps/map.service';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import type { MapRegion } from '@/types/maps';

type RegionDownloadInput = Parameters<typeof OfflineMapService.createRegionDownload>[0];

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
    manifestVersion: options.catalogVersion ?? MapPresetsService.getCatalogMeta().version,
    bounds: preset.bounds,
    minZoom: preset.minZoom,
    maxZoom: preset.maxZoom,
    estimatedSizeMb: preset.estimatedSizeMb,
    styleUrl: preset.styleUrl ?? MapService.getDefaultStyleUrl(options.theme),
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
  const regions = options.regions ?? (await OfflineMapService.listRegions());
  const existing = regions.find(
    (region) => region.manifestRegionId === preset.id || region.name === preset.name
  );
  if (existing) return existing.id;
  return OfflineMapService.createRegionDownload(presetToRegionDownloadInput(preset, options));
}
