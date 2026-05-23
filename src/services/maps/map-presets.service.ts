import { MAP_PRESETS, type MapPreset } from '@/constants/map-presets';

export class MapPresetsService {
  static listPresets() {
    return MAP_PRESETS;
  }

  static search(query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return MAP_PRESETS;
    return MAP_PRESETS.filter((preset) =>
      [preset.name, preset.description, ...preset.tags].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }

  static recommendedForLocation(location?: { latitude: number; longitude: number } | null) {
    if (!location) return MAP_PRESETS.slice(0, 3);
    const containing = MAP_PRESETS.filter((preset) => contains(preset, location));
    if (containing.length) {
      return containing
        .sort((a, b) => area(a) - area(b))
        .concat(MAP_PRESETS.filter((preset) => !containing.includes(preset)))
        .slice(0, 4);
    }
    return MAP_PRESETS.slice()
      .sort((a, b) => distanceToCenter(a, location) - distanceToCenter(b, location))
      .slice(0, 4);
  }
}

function contains(preset: MapPreset, location: { latitude: number; longitude: number }) {
  return (
    location.latitude <= preset.bounds.north &&
    location.latitude >= preset.bounds.south &&
    location.longitude <= preset.bounds.east &&
    location.longitude >= preset.bounds.west
  );
}

function area(preset: MapPreset) {
  return (preset.bounds.north - preset.bounds.south) * (preset.bounds.east - preset.bounds.west);
}

function distanceToCenter(preset: MapPreset, location: { latitude: number; longitude: number }) {
  const latitude = (preset.bounds.north + preset.bounds.south) / 2;
  const longitude = (preset.bounds.east + preset.bounds.west) / 2;
  return Math.hypot(latitude - location.latitude, longitude - location.longitude);
}
