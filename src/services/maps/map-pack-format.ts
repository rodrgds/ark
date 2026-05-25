import type { MapPreset } from '@/constants/map-presets';
import type { MapRegion, MapRegionPackFormat } from '@/types/maps';

type MapPackTarget = Pick<MapPreset, 'packFormat'> | Pick<MapRegion, 'packFormat'>;

export function getMapPackFormatLabel(format?: MapRegionPackFormat | null) {
  if (!format || format === 'maplibre_offline_pack') return 'MapLibre offline pack';
  if (format === 'pmtiles') return 'PMTiles';
  if (format === 'mbtiles') return 'MBTiles';
  return 'Vector tile pack';
}

export function isMapPackDownloadSupported(target: MapPackTarget) {
  return !target.packFormat || target.packFormat === 'maplibre_offline_pack';
}

export function getUnsupportedMapPackReason(target: MapPackTarget) {
  if (isMapPackDownloadSupported(target)) return null;
  return `${getMapPackFormatLabel(
    target.packFormat
  )} region packs are cataloged for future Ark map builds, but this app version can only download MapLibre offline packs.`;
}

