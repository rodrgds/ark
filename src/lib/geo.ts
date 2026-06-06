export const EARTH_RADIUS_METERS = 6_371_000;

export function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
) {
  const deltaLat = toRadians(latB - latA);
  const deltaLon = toRadians(lonB - lonA);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatPoint(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
