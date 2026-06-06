import type { MapCatalogRegion } from '../types/mapRegions';

export function getRegionAncestors(
  regionId: string,
  regions: MapCatalogRegion[]
): MapCatalogRegion[] {
  const ancestors: MapCatalogRegion[] = [];
  let current = regions.find((r) => r.id === regionId);

  while (current?.parentId) {
    const parentId = current.parentId;
    const parent = regions.find((r) => r.id === parentId);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
}

export function getRegionChildren(
  regionId: string,
  regions: MapCatalogRegion[]
): MapCatalogRegion[] {
  return regions.filter((r) => r.parentId === regionId);
}

export function getRegionDepth(regionId: string, regions: MapCatalogRegion[]): number {
  let depth = 0;
  let current = regions.find((r) => r.id === regionId);

  while (current?.parentId) {
    const parentId = current.parentId;
    const parent = regions.find((r) => r.id === parentId);
    if (!parent) break;
    depth++;
    current = parent;
  }

  return depth;
}
