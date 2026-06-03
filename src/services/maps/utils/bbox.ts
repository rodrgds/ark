export function isCoordinateInsideRegion(
  latitude: number,
  longitude: number,
  bbox: [number, number, number, number]
): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const [west, south, east, north] = bbox;
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

export function getBboxCenter(bbox: [number, number, number, number]): [number, number] {
  const [west, south, east, north] = bbox;
  return [(west + east) / 2, (south + north) / 2];
}

export function getBboxArea(bbox: [number, number, number, number]): number {
  const [west, south, east, north] = bbox;
  return Math.abs((east - west) * (north - south));
}

export function boxesIntersect(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  const [westA, southA, eastA, northA] = a;
  const [westB, southB, eastB, northB] = b;
  return westA <= eastB && eastA >= westB && southA <= northB && northA >= southB;
}
