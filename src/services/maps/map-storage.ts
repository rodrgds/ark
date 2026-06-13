import { FileSystemService } from '@/services/files/filesystem.service';
import type { MapRegion } from '@/types/maps';

const BYTES_PER_MB = 1024 * 1024;

export function estimatedMapRegionBytes(region: { estimatedSizeMb?: number | null }) {
  if (!Number.isFinite(region.estimatedSizeMb) || !region.estimatedSizeMb) return null;
  if (region.estimatedSizeMb <= 0) return null;
  return Math.ceil(region.estimatedSizeMb * BYTES_PER_MB);
}

export function formatMapRegionStorage(region: Pick<MapRegion, 'estimatedSizeMb' | 'sizeBytes'>) {
  if (region.sizeBytes && region.sizeBytes > 0) {
    return FileSystemService.formatBytes(region.sizeBytes);
  }
  const estimatedBytes = estimatedMapRegionBytes(region);
  if (estimatedBytes) return `About ${FileSystemService.formatBytes(estimatedBytes)}`;
  return 'Size pending';
}

export function summarizeMapRegionStorage(
  regions: Array<Pick<MapRegion, 'estimatedSizeMb' | 'sizeBytes'>>
) {
  const actualBytes = regions.reduce((total, region) => total + (region.sizeBytes ?? 0), 0);
  const estimatedPendingBytes = regions.reduce((total, region) => {
    if (region.sizeBytes && region.sizeBytes > 0) return total;
    return total + (estimatedMapRegionBytes(region) ?? 0);
  }, 0);

  if (actualBytes > 0 && estimatedPendingBytes > 0) {
    return `${FileSystemService.formatBytes(actualBytes)} stored, about ${FileSystemService.formatBytes(
      estimatedPendingBytes
    )} pending`;
  }
  if (actualBytes > 0) return `${FileSystemService.formatBytes(actualBytes)} stored`;
  if (estimatedPendingBytes > 0) {
    return `about ${FileSystemService.formatBytes(estimatedPendingBytes)} planned`;
  }
  return null;
}
