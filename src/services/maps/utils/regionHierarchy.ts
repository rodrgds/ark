import type { MapRegion } from '../types/mapRegions';

export function getRegionAncestors(regionId: string, regions: MapRegion[]): MapRegion[] {
  const ancestors: MapRegion[] = [];
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

export function getRegionChildren(regionId: string, regions: MapRegion[]): MapRegion[] {
  return regions.filter((r) => r.parentId === regionId);
}

export function getRegionDepth(regionId: string, regions: MapRegion[]): number {
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
