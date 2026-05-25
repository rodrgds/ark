import type { MapPreset } from '@/constants/map-presets';
import type { MapRegion } from '@/types/maps';

export type MapRegionUpdateReason =
  | 'checksum'
  | 'data_version'
  | 'region_updated_at'
  | 'manifest_version';

export type MapRegionUpdateState = {
  available: boolean;
  reasons: MapRegionUpdateReason[];
};

export function getMapRegionUpdateState(
  region: Pick<
    MapRegion,
    | 'checksumSha256'
    | 'dataVersion'
    | 'manifestVersion'
    | 'regionUpdatedAt'
    | 'status'
  >,
  preset?: Pick<MapPreset, 'checksumSha256' | 'dataVersion' | 'updatedAt'> | null,
  catalogVersion?: number | null
): MapRegionUpdateState {
  if (!preset || region.status !== 'downloaded') return { available: false, reasons: [] };

  const reasons: MapRegionUpdateReason[] = [];
  if (hasChanged(region.checksumSha256, preset.checksumSha256)) reasons.push('checksum');
  if (hasChanged(region.dataVersion, preset.dataVersion)) reasons.push('data_version');
  if (isNewerIsoDate(preset.updatedAt, region.regionUpdatedAt)) reasons.push('region_updated_at');
  if (
    reasons.length === 0 &&
    Number.isFinite(region.manifestVersion) &&
    Number.isFinite(catalogVersion) &&
    catalogVersion != null &&
    region.manifestVersion != null &&
    catalogVersion > region.manifestVersion
  ) {
    reasons.push('manifest_version');
  }

  return { available: reasons.length > 0, reasons };
}

function hasChanged(current?: string | null, latest?: string | null) {
  return Boolean(current && latest && current !== latest);
}

function isNewerIsoDate(latest?: string | null, current?: string | null) {
  if (!latest || !current) return false;
  const latestTime = Date.parse(latest);
  const currentTime = Date.parse(current);
  if (!Number.isFinite(latestTime) || !Number.isFinite(currentTime)) return false;
  return latestTime > currentTime;
}
